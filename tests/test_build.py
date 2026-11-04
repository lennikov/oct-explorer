import unittest
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build import build

class TestBuild(unittest.TestCase):
    def test_byte_for_byte(self):
        self.assertEqual(build().encode('utf-8'),(ROOT/'OCT_Volume_Studio.html').read_bytes())
    def test_offline_app(self):
        source=build()
        self.assertIn('JSZip v3.10.1',source)
        self.assertIn('const LesionMath=(()=>{',source)
        self.assertIn('WebGL 2',source)
        self.assertIn('Images stay in this browser',source)

if __name__=='__main__':unittest.main()
