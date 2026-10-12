import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from reconcile_private_history import AuditFailure, canonical, latest_journals, reconcile, source_archive


class PrivateReconciliationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Construct source fields here; use the real JS importer and seal code
        # to independently produce the data that the Python audit must inspect.
        names = '''cooks events cook_equipment cook_evaluations cook_fireboard_sessions cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment fireboard_account_access fireboard_probe_roles fireboard_temperature_samples locations rubs sauces weather future_table'''.split()
        tables = {name: dict(columns=['id'], rows=[]) for name in sorted(names)}
        def table(name, rows):
            tables[name] = dict(columns=list(rows[0]), rows=rows)
        table('cooks', [dict(id='cook-a', food='Synthetic café 🍖', start_time='2026-10-11 10:00:00+00', finish_time=None, notes='Smoker: Traeger Ironwood 885', location_id='location', cook_method_id='method', phase='Cooking'),
                       dict(id='cook-b', food='Synthetic second', start_time='2026-10-11 11:00:00+00', finish_time='2026-10-11 13:00:00+00', notes='[TEST COOK: EXCLUDE FROM ANALYSIS]', location_id=None, cook_method_id=None, phase='Finished')])
        table('events', [dict(id='event', cook_id='cook-a', event_time='2026-10-11 10:02:03+00', event_type='Meat On', note='Unicode 测试')])
        table('cook_fireboard_sessions', [dict(id='session', cook_id='cook-a')])
        table('fireboard_temperature_samples', [dict(id='sample-'+unit, cook_fireboard_session_id='session', observed_at='2026-10-11 10:03:00+00', temperature_value='225' if unit == '2' else '100.5', degree_type=unit, channel_label='Pit', channel_index='1', device_uuid='synthetic-device-'+unit) for unit in ('1', '2')])
        table('cook_equipment', [dict(id='link', cook_id='cook-a', equipment_id='equipment')])
        table('equipment', [dict(id='equipment', label='Synthetic kettle'), dict(id='unused', label='Unreferenced but retained')])
        table('locations', [dict(id='location', label='Synthetic')])
        table('cook_methods', [dict(id='method', label='Synthetic')])
        table('future_table', [dict(id='future', value='Preserve unknown fields')])
        table('fireboard_account_access', [dict(id='synthetic-config', value='synthetic-only')])
        body = dict(format='ldcooklog-supabase-relational-export', version=1, createdAt='2026-10-11T00:00:00Z', tables=tables)
        cls.source = dict(body, sha256=hashlib.sha256(canonical(body).encode()).hexdigest())
        script = """import {importArchive,emptyState,seal} from './recovery.js';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const state=(await importArchive(emptyState(),JSON.parse(raw))).state;
state.records.push({id:'extra-synthetic',food:'Extra',cooker:'Synthetic',startedAt:'2026-10-11T00:00:00Z',finishedAt:null,phase:'Preparation',events:[],temperatures:[],notes:'',source:'LDCookLog 2.0'});
console.log(JSON.stringify(await seal(state,3)));"""
        web = Path(__file__).resolve().parents[2] / 'native/Web'
        run = subprocess.run(['node', '--input-type=module', '-e', script], cwd=web, input=canonical(cls.source), text=True, capture_output=True, check=True)
        cls.envelope = json.loads(run.stdout)
        cls.body = json.loads(cls.envelope['payload'])

    def test_real_js_migration_reconciles_every_table_and_converted_series(self):
        report = reconcile(source_archive(self.source), self.body)
        self.assertEqual(report, dict(revision=3, sourceCooks=2, extraCooks=1, events=1, readings=2, sessions=1, tables=19))

    def test_same_counts_cannot_hide_changed_values_or_identifiers(self):
        changes = [('events', 'note', 'Altered'), ('events', 'legacyId', 'different'), ('temperatures', 'value', 226),
                   ('temperatures', 'unit', 'unknown'), ('temperatures', 'at', '2026-10-11T10:05:00.000Z'),
                   ('temperatures', 'deviceUUID', 'different'), ('temperatures', 'channelId', 'different')]
        for series, field, value in changes:
            with self.subTest(series=series, field=field):
                body = copy.deepcopy(self.body)
                body['state']['records'][0][series][0][field] = value
                with self.assertRaises(AuditFailure): reconcile(self.source, body)

    def test_complete_archive_and_lookup_changes_stop_even_when_counts_match(self):
        body = copy.deepcopy(self.body)
        body['state']['relationalArchives'][0]['tables']['future_table']['rows'][0]['value'] = 'Changed'
        with self.assertRaises(AuditFailure): reconcile(self.source, body)
        body = copy.deepcopy(self.body)
        body['state']['records'][0]['legacy']['lookups']['equipment'][0]['label'] = 'Changed'
        with self.assertRaises(AuditFailure): reconcile(self.source, body)

    def test_missing_source_cook_duplicate_id_or_missing_archive_stop(self):
        for change in ('cook', 'duplicate', 'archive'):
            body = copy.deepcopy(self.body)
            if change == 'cook': body['state']['records'].pop(0)
            elif change == 'duplicate': body['state']['records'].append(body['state']['records'][0])
            else: body['state']['relationalArchives'] = []
            with self.assertRaises(AuditFailure): reconcile(self.source, body)

    def test_both_cloud_journals_read_without_changes_and_corrupt_newest_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            device = root / '12345678-1234-1234-1234-123456789abc'
            device.mkdir()
            file = device / '0000000000000003-12345678-1234-1234-1234-123456789abc.recovery.json'
            file.write_text(canonical(self.envelope))
            before = file.read_bytes()
            self.assertEqual(reconcile(self.source, latest_journals(root)[0])['readings'], 2)
            self.assertEqual(file.read_bytes(), before)
            bad = device / '0000000000000004-12345678-1234-1234-1234-123456789abc.recovery.json'
            bad.write_text('broken')
            with self.assertRaises(ValueError): latest_journals(root)
            self.assertEqual(file.read_bytes(), before)
            self.assertEqual(bad.read_text(), 'broken')

    def test_invalid_source_checksum_or_timezone_stops(self):
        source = copy.deepcopy(self.source)
        source['tables']['equipment']['rows'][0]['label'] = 'Changed'
        with self.assertRaises(AuditFailure): source_archive(source)
        body = copy.deepcopy(self.body)
        source = copy.deepcopy(self.source)
        source['tables']['cooks']['rows'][0]['start_time'] = '2026-10-11 10:00:00'
        base = {key: source[key] for key in ('format', 'version', 'createdAt', 'tables')}
        source['sha256'] = hashlib.sha256(canonical(base).encode()).hexdigest()
        body['state']['relationalArchives'] = [source]
        body['state']['records'][0]['legacy']['cook'] = source['tables']['cooks']['rows'][0]
        # Comparison must refuse ambiguous timestamps instead of assuming UTC.
        with self.assertRaisesRegex(AuditFailure, 'timezone'): reconcile(source, body)

    def test_standalone_cli_requires_both_journals_and_prints_no_private_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'private-source.json'
            source.write_text(canonical(self.source))
            before = source.read_bytes()
            for label in ('working', 'trial'):
                device = root / label / '12345678-1234-1234-1234-123456789abc'
                device.mkdir(parents=True)
                (device / '0000000000000003-12345678-1234-1234-1234-123456789abc.recovery.json').write_text(canonical(self.envelope))
            command = [sys.executable, str(Path(__file__).with_name('reconcile_private_history.py')), '--source-export', str(source), '--working-root', str(root / 'working'), '--restored-root', str(root / 'trial')]
            result = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertIn('FULL SOURCE RECONCILIATION PASS', result.stdout)
            self.assertIn('Restored trial device 1: SOURCE MATCH PASS', result.stdout)
            self.assertNotIn('Synthetic café', result.stdout)
            self.assertNotIn('Unicode 测试', result.stdout)
            self.assertNotIn(str(source), result.stdout)
            self.assertEqual(source.read_bytes(), before)
            bad = root / 'trial' / '12345678-1234-1234-1234-123456789abc' / '0000000000000004-12345678-1234-1234-1234-123456789abc.recovery.json'
            bad.write_text('broken')
            result = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn('FULL SOURCE RECONCILIATION PASS', result.stdout)
            self.assertEqual(bad.read_text(), 'broken')


if __name__ == '__main__': unittest.main()
