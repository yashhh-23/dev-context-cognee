New files to create
text
extension/src/
├── commands/
│   ├── improveContext.ts      ← NEW: Cmd+Shift+U → POST /api/memify
│   └── forgetContext.ts       ← NEW: Cmd+Shift+D → POST /api/forget
├── utils/
│   ├── scoreManager.ts        ← NEW: gamification point tracking
│   └── stateManager.ts        ← NEW: persistent session state via Memento
└── provider/
    └── graphRenderer.ts       ← NEW: renders bug connection graph in sidebar

backend/app/api/
├── memify.py                  ← NEW: POST /api/memify
└── forget.py                  ← NEW: POST /api/forget

backend/app/services/
├── memify_service.py          ← NEW: cognee improve logic
└── forget_service.py          ← NEW: cognee delete logic
Files to modify
text
extension/src/extension.ts     ← register 2 new commands
extension/src/provider.ts      ← add graph section + score badge + recently enhanced
extension/package.json         ← add 2 new command entries + keyboard shortcuts
backend/app/main.py            ← register memify + forget routers