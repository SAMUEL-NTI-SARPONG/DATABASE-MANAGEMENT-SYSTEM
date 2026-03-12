# Extracted Functions from public/app.js

## Summary of Line Ranges

| Group                 | Function                        | Lines       |
| --------------------- | ------------------------------- | ----------- |
| **Constants**         | `state`, `REC_CATEGORIES`, etc. | 7–55        |
| **Auth**              | `showLogin`                     | 252–262     |
| **Auth**              | `showSetupWizard`               | 264–344     |
| **Auth**              | `initLoginForm`                 | 346–441     |
| **Auth**              | `logout`                        | 795–800     |
| **Auth**              | `showApp`                       | 558–590     |
| **Nav**               | `switchView`                    | 812–876     |
| **Nav**               | `updateThemeIcon`               | 237–240     |
| **DOMContentLoaded**  | Init block                      | 71–86       |
| **Records Constants** | `REC_FIELD_SECTIONS`            | 9099–9180   |
| **Records Constants** | `REC_MASTER_COLS`               | 9182–9189   |
| **Records View**      | `renderRecordsView`             | 9191–9210   |
| **Records View**      | `renderRecordsTreeSidebar`      | 9212–9236   |
| **Records View**      | `toggleRecTreeNode`             | 9238–9241   |
| **Records View**      | `loadRecTreeYears`              | 9243–9296   |
| **Records View**      | `selectRecQuarter`              | 9298–9310   |
| **Records View**      | `showRecQuarterCtx`             | 9313–9325   |
| **Records View**      | `showAddYearModal`              | 9328–9344   |
| **Records View**      | `submitAddYear`                 | 9346–9357   |
| **Records View**      | `loadRecordsWorkspace`          | 9357–9442   |
| **Records View**      | `recGetStatusClass`             | 9444–9453   |
| **Records View**      | `recHandleSearch`               | 9455–9459   |
| **Records View**      | `recSelectRow`                  | 9462–9476   |
| **Records View**      | `recRenderInspectorContent`     | 9478–9489   |
| **Records View**      | `recRenderDetailInspector`      | 9491–9524   |
| **Records View**      | `formatGHS`                     | 9526–9530   |
| **Records View**      | `recStartAddEntry`              | 9533–9542   |
| **Records View**      | `recCancelAdd`                  | 9544–9553   |
| **Records View**      | `recRenderAddForm`              | 9555–9603   |
| **Records View**      | `recLoadSectorSuggestions`      | 9605–9613   |
| **Records View**      | `recAutoCalcTotals`             | 9615–9631   |
| **Records View**      | `recSubmitEntry`                | 9633–9661   |
| **Records View**      | `recStartEditEntry`             | 9663–9675   |
| **Records View**      | `recDeleteEntry`                | 9677–9690   |
| **CSV**               | `recHandleCSVDrop`              | 9692–9721   |
| **CSV**               | `recParseCSV`                   | 9723–9757   |
| **Excel**             | `recHandleExcelUpload`          | 9759–9780   |
| **Excel**             | `showExcelImportWizard`         | 9782–9874   |
| **Excel**             | `executeExcelImport`            | 9876–9932   |
| **Excel**             | `recShowExcelUploadPicker`      | 9934–9943   |
| **Excel**             | `recScanAndImportAll`           | 9945–9967   |
| **Excel**             | `showExcelScanResultsModal`     | 9969–10013  |
| **Admin**             | `recShowAdminPanel`             | 10016–10034 |
| **Admin**             | `recLoadAdminPanel`             | 10036–10095 |
| **Admin**             | `recAdminBulkDelete`            | 10097–10114 |
| **CSV Export**        | `recExportCSV`                  | 10116–10143 |
| **Analytics**         | `renderRecordsAnalyticsView`    | 10146–10282 |
| **Analytics**         | `recAnalyticsFilter`            | 10284–10288 |
| **Analytics**         | `recRenderAnalyticsCharts`      | 10290–10362 |
| **Users**             | `renderUsersView`               | 5097–5135   |
| **Users**             | `showAddUserModal`              | 5137–5155   |
| **Users**             | `addUser`                       | 5157–5179   |
| **Users**             | `showEditUserModal`             | 5181–5210   |
| **Users**             | `editUser`                      | 5212–5237   |
| **Users**             | `deleteUser`                    | 5220–5246   |
| **Users**             | `showUserContextMenu`           | 7449–7487   |
| **Settings**          | `renderSettingsView`            | 5248–5284   |
| **Settings**          | `showSettingsProfile`           | 5286–5297   |
| **Settings**          | `showSettingsPassword`          | 5299–5327   |
| **Settings**          | `showSettingsDropdowns`         | 5329–5510   |
| **Settings**          | `showSettingsCustomFields`      | 5512–5709   |
| **Settings**          | `showSettingsFieldRenames`      | 5711–5833   |
| **Settings**          | `showSettingsAbout`             | 5835–5864   |
| **Settings**          | `showSettingsUpdates`           | 5866–5992   |
| **Settings**          | `showSettingsClientAccess`      | 5998–6187   |
| **Settings**          | `showSettingsEmployees`         | 6189–6571   |
| **Settings**          | `showSettingsDataMgmt`          | 6573–6618   |
| **Settings**          | `showSettingsBackup`            | 6620–6936   |
| **Settings**          | `showSettingsDocuments`         | 6938–6995   |

---
