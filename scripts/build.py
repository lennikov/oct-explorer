#!/usr/bin/env python3
"""Losslessly rebuild the uploaded standalone OCT HTML from annotated segments."""
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]
PARTS = [
  '01-file-identity-and-catalog.js',
  '02-calibration-and-palette.js',
  '03-video-codecs.js',
  '04-lesion-analysis.js',
  '05-ui-and-state.js',
  '06-import-and-volume.js',
  '07-volume-rendering.js',
  '08-export-workflows.js',
]

def strip_repo_annotation(text: str) -> str:
    if not text.startswith('/* @repo-annotation: '):
        raise ValueError('Missing repo annotation')
    end = text.find('*/\n')
    if end < 0:
        raise ValueError('Unterminated repo annotation')
    return text[end+3:]

def build() -> str:
    template=(ROOT/'src/template.html').read_text(encoding='utf-8')
    app=''.join(strip_repo_annotation((ROOT/'src'/name).read_text(encoding='utf-8')) for name in PARTS)
    replacements={
      '@@OCT_STYLE@@':(ROOT/'src/style.css').read_text(encoding='utf-8'),
      '@@OCT_VENDOR_JS@@':(ROOT/'vendor/jszip-3.10.1.min.js').read_text(encoding='utf-8'),
      '@@OCT_APP_JS@@':app,
    }
    for marker,content in replacements.items():
        if template.count(marker)!=1:
            raise ValueError('Unexpected count for template marker '+marker)
        template=template.replace(marker,content)
    if '@@OCT_' in template:
        raise ValueError('Unresolved build placeholder')
    return template

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true',help='Check the rebuilt HTML against the archived original')
    parser.add_argument('--output',default=str(ROOT/'OCT_Volume_Studio.html'))
    args=parser.parse_args()
    content=build().encode('utf-8')
    if args.check:
        archived=(ROOT/'OCT_Volume_Studio.html').read_bytes()
        if archived!=content:
            raise SystemExit('ERROR: rebuild differs from recovered source')
        print('OK: byte-exact OCT snapshot reconstructed')
    else:
        Path(args.output).write_bytes(content)
        print('Wrote',args.output,'('+str(len(content))+' bytes)')
