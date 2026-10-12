# data/ — Dataset Directory

See `docs/dataset_sources.md` for full documentation of each dataset
(official URLs, licenses, schemas, limitations). Quick reference:

```
data/
├── EngineAD/
│   └── EngineAD_paper.pdf        Paper only. Real fleet pickles are
│                                  access-gated — request at
│                                  github.com/Armanfard-Lab/EngineAD and
│                                  place truck_*.pickle files here.
├── EngineFaultDB/
│   └── EngineFaultDB_Final.csv   Real, included. 55,999 rows, 4 fault classes.
├── NASA_RUL/
│   ├── train_FD001.txt           Real, included. NASA C-MAPSS turbofan
│   ├── test_FD001.txt             run-to-failure data (NOT automotive).
│   ├── RUL_FD001.txt
│   └── readme.txt                 Original NASA documentation.
├── Automotive_Faults/
│   ├── automotive_faults_aktc_obike_et_al.json   99 real fault entries.
│   └── *.png                      Diagnostic flowcharts.
└── demo/
    └── demo_vehicle_telemetry.csv  SYNTHETIC — NOT REAL VEHICLE DATA.
                                     Regenerate with
                                     scripts/generate_demo_data.py
```

## Re-generating everything

```bash
python scripts/prepare_data.py         # inspect/validate all 5 sources
python scripts/generate_demo_data.py   # rebuild demo/demo_vehicle_telemetry.csv
```

Training scripts (`scripts/train_*.py`) read directly from this directory —
no separate data-loading service is used, keeping the "which file feeds
which model" relationship transparent and auditable.
