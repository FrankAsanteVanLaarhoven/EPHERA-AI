# Third-party notices

EPHERA is built on third-party open-source software, each component under its own
licence. This file records where the authoritative dependency manifests live and
names the major frameworks for orientation. It is **not** a complete inventory —
before any production release, a full software bill of materials (SBOM) must be
produced by tooling and treated as authoritative over this file.

## Where the authoritative lists live

| Ecosystem | Manifests / lock files |
| --- | --- |
| Go services | `services/*/go.mod`, `services/*/go.sum` |
| JS/TS workspace | root `package.json` + `packages/*/package.json` + `apps/*/package.json`, and the workspace lock file |
| Python (research notebooks) | `notebooks/model/requirements.txt` |

## Major dependencies (orientation, not exhaustive)

| Component | Typical licence |
| --- | --- |
| React, Next.js | MIT |
| Expo / React Native | MIT |
| Temporal SDK | MIT |
| `github.com/jackc/pgx` (PostgreSQL driver) | MIT |
| `golang.org/x/...` | BSD-3-Clause |
| scikit-learn, pandas, NumPy, joblib (notebooks) | BSD-3-Clause |

All of the above are permissive licences compatible with this project's
Apache-2.0 distribution. Any copyleft or source-available dependency introduced
later must be reviewed for compatibility before it ships.

## Generating the authoritative SBOM

Before a release, produce and commit the machine-generated inventory:

```bash
# Go
go install github.com/google/go-licenses@latest
for d in services/*/; do (cd "$d" && go-licenses report ./... ); done > sbom-go.txt

# JS/TS workspace
npx license-checker --production --summary > sbom-node.txt

# Python
pip install pip-licenses && pip-licenses --format=markdown > sbom-python.txt
```

Treat any discrepancy between this file and the tool output as this file being
out of date.
