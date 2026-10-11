import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from convert_dump import decode_copy_field, parse_copy, make_archive, EXPECTED

class ConverterTests(unittest.TestCase):
    def test_pg_copy_escape_decoding(self):
        self.assertIsNone(decode_copy_field(r'\N'))
        self.assertEqual(decode_copy_field(r'Meat\tOn\n\r\\notes'), 'Meat\tOn\n\r\\notes')
        self.assertEqual(decode_copy_field(r'\x41\101'), 'AA')
        self.assertEqual(decode_copy_field(r'\\N'), r'\N')

    def test_complete_blocks_and_empty_tables(self):
        text = 'COPY public.cooks (id, food, notes) FROM stdin;\n123\tPork\\tbutt\t\\N\n\\.\nCOPY public.events (id, cook_id) FROM stdin;\n\\.\n'
        got = parse_copy(text.splitlines(True))
        self.assertEqual(got['cooks']['rows'], [{'id':'123','food':'Pork\tbutt','notes':None}])
        self.assertEqual(got['events']['rows'], [])

    def test_no_silent_truncation(self):
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            parse_copy(['COPY public.cooks (id) FROM stdin;\n','abc\n'])
        with self.assertRaisesRegex(ValueError, 'expected 2 columns'):
            parse_copy(['COPY public.cooks (id, food) FROM stdin;\n','abc\n'])

    def test_archive_sha_stable(self):
        archive=make_archive({'cooks': {'columns':['id','food'], 'rows':[{'id':'1','food':'Ribs 🐖'}]}},'2026-10-11T09:00:00Z')
        self.assertEqual(len(archive['sha256']),64)
        self.assertEqual(archive['tables']['cooks']['rows'][0]['food'],'Ribs 🐖')
        self.assertEqual(len(EXPECTED),18)

if __name__=='__main__': unittest.main()
