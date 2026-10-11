import type { Catalog } from './types'

/**
 * Korean catalogue. Typed as `Catalog`, so TypeScript fails the build if a key
 * is missing, misspelled or added to `en` without a translation here.
 *
 * Korean has no plural distinction, so `.one` and `.other` variants are
 * intentionally identical.
 */
export const ko: Catalog = {
  /* ------------------------------------------------------------------ app */
  'app.subtitle': '파일 및 인쇄 기록',

  'nav.overview': '개요',
  'nav.dashboard': '대시보드',
  'nav.folders': '폴더',
  'nav.files': '파일',
  'nav.history': '인쇄 기록',
  'nav.settings': '설정',
  'nav.query': '쿼리',

  'sidebar.spoolerMonitoring': '스풀러 모니터링 중',
  'sidebar.spoolerIdle': '스풀러 대기 중',
  'sidebar.windowsOnly': '(Windows 전용)',
  'sidebar.filesIndexed': '파일 {count}개 색인됨',
  'sidebar.indexing': '색인 중…',

  /* --------------------------------------------------------------- common */
  'common.cancel': '취소',
  'common.refresh': '새로 고침',
  'common.delete': '삭제',
  'common.open': '열기',
  'common.locate': '위치 열기',
  'common.remove': '제거',
  'common.rescan': '다시 검사',
  'common.copy': '복사',
  'common.optional': '선택 사항',
  'common.unknownDocument': '알 수 없는 문서',
  'common.loading': '불러오는 중…',
  'common.emptyValue': '—',
  'common.refreshing': '새로 고치는 중…',
  'common.never': '없음',

  /* ----------------------------------------------------------- page help */
  'help.summary': '이 페이지는 무엇인가요?',

  'help.overview':
    '무엇을 인쇄했고 무엇을 아직 인쇄하지 않았는지 두 목록으로 보여주는 첫 화면입니다.\n\n왼쪽은 Print Tracker가 인쇄한 것을 확인한 파일이고, 오른쪽은 아직 확인하지 못한 파일입니다.\n\n이 화면은 문서를 변경하지 않습니다. 앱은 문서에 대한 기록만 남깁니다.',

  'help.dashboard':
    '지금까지 Print Tracker가 확인한 내용을 숫자와 그래프로 요약합니다.\n\n"오늘"과 "이번 주"는 컴퓨터의 시계와 달력 설정을 기준으로 합니다. 숫자가 이상해 보이면 폴더 화면에서 해당 폴더를 계속 추적 중인지 확인해 보세요.\n\n위쪽 두 버튼으로 폴더 목록이나 전체 인쇄 기록으로 바로 이동할 수 있습니다.',

  'help.folders':
    'Print Tracker가 지켜보는 폴더입니다. 폴더를 한 번 추가하면 그 안의 파일이 목록에 표시됩니다.\n\n파일은 복사되거나 이동되지 않으며 변경되지도 않습니다. 앱은 파일 이름, 크기, 마지막 인쇄 시점 같은 정보만 기억합니다.\n\nLibrary 폴더는 목록만 만들고, Output 폴더는 새로 생긴 파일도 인쇄한 것으로 기록합니다. 파일을 폴더에 저장하는 방식으로 인쇄한다면 Output 폴더가 편리합니다. 다시 검사는 폴더를 처음부터 다시 읽습니다.',

  'help.files':
    '추가한 폴더에서 Print Tracker가 찾은 모든 파일입니다.\n\n검색창에 입력하면 파일 이름이나 그 파일이 들어 있는 폴더 이름으로 찾을 수 있습니다. 정렬과 필터도 사용할 수 있습니다.\n\n"없음" 표시는 앱이 마지막으로 본 위치에 파일이 없다는 뜻이며, 보통 앱 밖에서 이동하거나 이름을 바꾸거나 삭제한 경우입니다. 파일을 열거나, 폴더에서 보거나, 인쇄 기록을 직접 남길 수 있습니다.',

  'help.history':
    '앱이 파악한 모든 인쇄를 최신 순으로 보여주는 목록입니다.\n\n각 행의 작은 태그는 그 인쇄를 어떻게 알게 되었는지 나타냅니다. 추적 중인 폴더, Windows가 보관하는 인쇄 기록, 또는 직접 추가한 경우입니다.\n\n기록을 삭제해도 이 목록에서만 사라지며 파일 자체에는 영향이 없습니다.',

  'help.query':
    '고급 사용자를 위한 도구입니다. SQL이라는 언어로 질문을 입력하면 결과가 표로 나타납니다.\n\n기본값은 보기 전용이라 아무것도 바꿀 수 없습니다. SQL을 잘 아는 경우에만 읽기 전용을 해제하세요. 그곳에서의 변경은 되돌릴 수 없습니다.\n\nSQL이 무엇인지 모르신다면 이 화면은 사용할 필요가 없습니다.',

  'help.settings':
    'Print Tracker의 동작을 바꾸는 모든 설정입니다.\n\n화면 표시에서 언어와 밝은/어두운 색상을 정합니다. 인쇄 추적은 Windows의 인쇄 기록 사용 여부를 정하며 Windows에서만 동작합니다. 백업은 앱이 저장한 내용의 사본으로, 앱을 시작할 때마다 자동으로 만들어지며 직접 만들거나 이전 시점으로 되돌릴 수도 있습니다.\n\n감시는 폴더를 얼마나 자주 확인할지 정합니다. 위험 구역은 앱이 저장한 내용을 모두 지우고 처음 상태로 되돌립니다.',

  'source.watcher': '폴더 감시',
  'source.spooler': '스풀러',
  'source.manual': '수동',

  'unit.prints.one': '{count}회 인쇄',
  'unit.prints.other': '{count}회 인쇄',

  /* ------------------------------------------------------------ dashboard */
  'dashboard.title': '대시보드',
  'dashboard.subtitle': '폴더와 파일, 인쇄 기록을 한눈에 요약합니다.',
  'dashboard.manageFolders': '폴더 관리',
  'dashboard.printHistory': '인쇄 기록',

  'dashboard.stat.folders': '폴더',
  'dashboard.stat.files': '색인된 파일',
  'dashboard.stat.prints': '기록된 인쇄',
  'dashboard.stat.today': '오늘',
  'dashboard.stat.week': '이번 주',

  'dashboard.hint.watched': '감시 중',
  'dashboard.hint.present': '현재 존재',
  'dashboard.hint.allTime': '전체 기간',
  'dashboard.hint.sinceMidnight': '자정 이후',
  'dashboard.hint.sinceMonday': '월요일 이후',

  'dashboard.chart.title': '인쇄 — 최근 14일',
  'dashboard.chart.tooltip': '{day}: {count}회 인쇄',

  'dashboard.sources.title': '탐지 방식별',
  'dashboard.sources.watcher': '출력 폴더에 나타난 파일',
  'dashboard.sources.spooler': 'Windows 인쇄 큐 및 이벤트 로그',
  'dashboard.sources.manual': '직접 기록',

  'dashboard.top.title': '가장 많이 인쇄됨',
  'dashboard.top.emptyTitle': '아직 기록된 인쇄가 없습니다',
  'dashboard.top.emptyBody': '출력 폴더를 추가하거나 파일을 인쇄됨으로 표시하세요.',
  'dashboard.recent.title': '최근 활동',
  'dashboard.recent.empty': '아직 인쇄된 항목이 없습니다.',
  'dashboard.loading': '대시보드를 불러오는 중…',

  /* -------------------------------------------------------------- overview */
  'overview.title': '개요',
  'overview.subtitle': '인쇄된 파일과 아직 인쇄되지 않은 파일입니다.',
  'overview.printed.title': '인쇄됨',
  'overview.notPrinted.title': '인쇄 안 됨',
  'overview.printed.empty': '아직 인쇄된 파일이 없습니다.',
  'overview.notPrinted.empty': '추적 중인 모든 파일이 인쇄되었습니다.',
  'overview.summary': '전체 {total}개 중 {printed}개 인쇄됨',
  'overview.loading': '개요를 불러오는 중…',
  'overview.searchPlaceholder': '파일 또는 폴더 검색…',
  'overview.filtered': '"{term}" 검색 결과',
  'overview.search.noMatch': '"{term}"와 일치하는 파일이 없습니다.',

  /* -------------------------------------------------------------- folders */
  'folders.title': '폴더',
  'folders.subtitle':
    'Print Tracker가 지켜보는 폴더입니다. 파일은 원래 위치에 그대로 있습니다.',
  'folders.rescanAll': '전체 다시 검사',
  'folders.add': '+ 폴더 추가',

  'folders.table.folder': '폴더',
  'folders.table.role': '역할',
  'folders.table.subfolders': '하위 폴더',
  'folders.table.enabled': '사용',
  'folders.table.files': '파일',

  'folders.role.library': 'Library',
  'folders.role.output': 'Output / 스풀',
  'folders.role.libraryLong': 'Library — 파일만 색인하고 자동 인쇄 기록은 하지 않음',
  'folders.role.outputLong': 'Output / 스풀 — 새 파일을 인쇄로 기록',
  'folders.recursive': '하위 포함',
  'folders.badge.output': '출력',

  'folders.loading': '폴더를 불러오는 중…',
  'folders.emptyTitle': '추적 중인 폴더가 없습니다',
  'folders.emptyBody':
    '문서가 있는 폴더를 추가하거나, 인쇄 작업이 파일을 저장하는 출력 폴더를 추가하세요.',
  'folders.confirmRemove':
    '"{name}" 추적을 중단할까요?\n\n색인된 파일은 데이터베이스에서 제거됩니다. 기록된 인쇄 내역은 유지됩니다.',

  'folders.modal.title': '폴더 추적',
  'folders.modal.folder': '폴더',
  'folders.modal.role': '역할',
  'folders.modal.includeSubfolders': '하위 폴더 포함',
  'folders.modal.note':
    '파일은 복사되지 않습니다. Print Tracker는 경로와 크기, 타임스탬프만 로컬 데이터베이스에 저장합니다.',
  'folders.modal.submit': '폴더 추가',
  'folders.modal.submitting': '색인 중…',

  'folders.toast.rescanned': '"{name}" 다시 검사 완료 — 파일 {count}개.',
  'folders.toast.rescannedAll': '폴더 {folders}개 다시 검사 완료 — 파일 {files}개.',

  /* ---------------------------------------------------------------- files */
  'files.title': '파일',
  'files.count.one': '색인된 파일 {count}개',
  'files.count.other': '색인된 파일 {count}개',
  'files.searchPlaceholder': '파일 이름, 폴더 또는 경로 검색…',
  'files.allFolders': '모든 폴더',
  'files.sort.nameAsc': '이름 A→Z',
  'files.sort.nameDesc': '이름 Z→A',
  'files.sort.recent': '최근 변경순',
  'files.sort.prints': '인쇄 많은 순',
  'files.sort.lastPrinted': '최근 인쇄순',
  'files.sort.size': '큰 파일순',
  'files.printedOnly': '인쇄된 항목만',
  'files.loading': '파일을 불러오는 중…',
  'files.emptyTitle': '일치하는 파일이 없습니다',
  'files.emptyBody': '추적할 폴더를 추가하거나 위 필터를 완화하세요.',

  'files.table.file': '파일',
  'files.table.folder': '폴더',
  'files.table.size': '크기',
  'files.table.modified': '수정됨',
  'files.table.prints': '인쇄',
  'files.table.lastPrinted': '마지막 인쇄',

  'files.badge.missing': '없음',
  'files.markPrinted': '인쇄로 표시',
  'files.confirmRemove':
    '"{name}"을(를) 색인에서 제거할까요?\n\n디스크의 파일은 변경되지 않습니다. 기록된 인쇄 내역은 유지됩니다.',
  'files.toast.removed': '"{name}"을(를) 색인에서 제거했습니다.',

  /* -------------------------------------------------------------- history */
  'history.title': '인쇄 기록',
  'history.count.one': '인쇄 기록 {count}건',
  'history.count.other': '인쇄 기록 {count}건',
  'history.logPrint': '+ 인쇄 기록 추가',
  'history.searchPlaceholder': '문서, 폴더, 프린터 또는 메모 검색…',
  'history.allSources': '모든 방식',
  'history.loading': '기록을 불러오는 중…',
  'history.emptyTitle': '인쇄 기록이 없습니다',
  'history.emptyBody': '폴더 감시나 인쇄 스풀러가 감지하면 여기에 표시됩니다.',

  'history.table.printed': '인쇄 시각',
  'history.table.document': '문서',
  'history.table.source': '방식',
  'history.table.printer': '프린터',
  'history.table.copies': '부수',
  'history.table.pages': '페이지',
  'history.table.user': '사용자',

  /* --------------------------------------------------------- manual entry */
  'manual.title': '인쇄 기록 추가',
  'manual.document': '문서',
  'manual.documentPlaceholder': '예: invoice-2026-10.pdf',
  'manual.documentHint': '색인된 파일 이름과 일치하면 해당 파일에 자동으로 연결됩니다.',
  'manual.printer': '프린터',
  'manual.copies': '부수',
  'manual.pages': '페이지',
  'manual.printedAt': '인쇄 시각',
  'manual.note': '메모',
  'manual.submit': '인쇄 기록',
  'manual.saving': '저장 중…',
  'manual.toast.saved': '인쇄 기록을 저장했습니다.',
  'manual.error.document': '문서 이름을 입력하거나 색인된 파일 중에서 선택하세요.',

  /* ---------------------------------------------------------------- query */
  'query.title': '쿼리',
  'query.subtitle': '고급 사용자용: 저장된 데이터에 직접 질문합니다.',
  'query.schema.title': '스키마',
  'query.editor.placeholder': 'SELECT * FROM files LIMIT 50;',
  'query.run': '실행',
  'query.readOnly': '읽기 전용',
  'query.readOnlyHint':
    '문은 항상 롤백되는 트랜잭션 안에서 실행되며 SELECT / WITH / EXPLAIN / PRAGMA만 허용됩니다.',
  'query.writeHint':
    '쓰기 모드에서는 변경 사항이 영구적으로 적용됩니다. 되돌리려면 앱 시작 시 만들어진 스냅샷을 사용하세요.',
  'query.result.rows': '{count}개 행',
  'query.result.changes': '{count}개 행 영향',
  'query.result.executed': '문을 실행했습니다.',
  'query.error.title': '실행 실패',
  'query.error.readOnly':
    '읽기 전용 모드에서는 SELECT, WITH, EXPLAIN, PRAGMA, VALUES만 실행할 수 있습니다.',

  /* ------------------------------------------------------------- settings */
  'settings.title': '설정',
  'settings.subtitle': '환경 설정과 백업, 관리 기능입니다.',

  'settings.appearance.title': '표시 설정',
  'settings.appearance.language': '표시 언어',
  'settings.appearance.system': '시스템 기본값',
  'settings.appearance.theme': '테마',
  'settings.appearance.themeLight': '라이트',
  'settings.appearance.themeDark': '다크',

  'settings.spooler.title': 'Windows 인쇄 스풀러',
  'settings.spooler.running': '실행 중',
  'settings.spooler.stopped': '중지됨',
  'settings.spooler.start': '모니터링 시작',
  'settings.spooler.stop': '모니터링 중지',
  'settings.spooler.pollNow': '지금 확인',
  'settings.spooler.listPrinters': '프린터 목록',
  'settings.spooler.pollInterval': '확인 주기(초)',
  'settings.spooler.autoStart': '앱 시작 시 모니터링',
  'settings.spooler.eventLog': '이벤트 로그 사용',
  'settings.spooler.eventLogEnabled': '예 — Microsoft-Windows-PrintService/Operational 읽는 중',
  'settings.spooler.eventLogDisabled': '아니요 — 인쇄 큐 추적으로 대체',
  'settings.spooler.eventLogUnknown': '알 수 없음',
  'settings.spooler.lastPoll': '마지막 확인',
  'settings.spooler.never': '없음',
  'settings.spooler.printers': '감지된 프린터',
  'settings.spooler.unsupported':
    '스풀러 모니터링은 Windows에서만 동작합니다. 이 플랫폼에서도 폴더 감시와 수동 기록은 그대로 사용할 수 있습니다.',
  'settings.spooler.enableLog':
    '운영 인쇄 로그가 비활성화되어 있어 완료된 작업을 인쇄 큐에서 추정합니다. 정확한 페이지 수와 문서 이름을 얻으려면 관리자 권한 PowerShell에서 한 번 활성화하세요:',

  'settings.backups.title': '백업',
  'settings.backups.description':
    '앱을 시작할 때마다 스냅샷을 만들고 최근 10개를 보관합니다.',
  'settings.backups.create': '지금 백업',
  'settings.backups.empty': '백업이 없습니다.',
  'settings.backups.created': '백업을 만들었습니다.',
  'settings.backups.removed': '백업을 삭제했습니다.',
  'settings.backups.confirmRemove': '이 백업을 삭제할까요?\n\n{name}',

  'settings.watching.title': '폴더 감시',
  'settings.watching.autoStart': '앱 실행 중 폴더 감시',
  'settings.watching.stability': '쓰기 완료 대기(ms)',
  'settings.watching.note':
    '출력 폴더의 파일이 이 시간 동안 변경되지 않으면 인쇄로 간주합니다. 인쇄 과정에서 파일이 여러 번 저장된다면 값을 늘리세요.',

  'settings.about.title': '정보',
  'settings.about.application': '애플리케이션',
  'settings.about.platform': '플랫폼',
  'settings.about.runtime': 'Electron / Node / Chromium',
  'settings.about.dataDir': '데이터 폴더',
  'settings.about.database': '데이터베이스',
  'settings.about.sessionUptime': '세션 실행 시간',

  /* ------------------------------------------------------- settings: reset */
  'settings.reset.danger': '위험 구역',
  'settings.reset.description':
    '빈 데이터베이스로 초기화합니다. 추적 중인 폴더, 색인된 파일, 인쇄 기록이 모두 삭제됩니다. 디스크의 파일은 삭제되지 않습니다.',
  'settings.reset.open': '앱 초기화…',
  'settings.reset.title': '앱 데이터 초기화',
  'settings.reset.intro': '다음 항목이 영구적으로 삭제됩니다:',
  'settings.reset.folders': '추적 중인 폴더',
  'settings.reset.files': '색인된 파일',
  'settings.reset.prints': '인쇄 기록',
  'settings.reset.backups': '저장된 백업',
  'settings.reset.warning':
    '되돌릴 수 없습니다. 문서 자체는 삭제되지 않고, Print Tracker가 기록한 정보만 삭제됩니다.',
  'settings.reset.backupFirst': '되돌릴 수 있도록 먼저 백업 저장',
  'settings.reset.removeBackups': '기존 백업 {count}개도 함께 삭제',
  'settings.reset.confirmWord': '초기화',
  'settings.reset.confirmLabel': '확인을 위해 {word} 입력',
  'settings.reset.confirm': '지금 초기화',
  'settings.reset.working': '초기화 중…',

  /* ----------------------------------------------------- settings: restore */
  'settings.backups.restore': '복원',
  'settings.backups.restoreFromFile': '파일에서 복원…',
  'settings.restore.title': '백업에서 복원',
  'settings.restore.file': '파일',
  'settings.restore.size': '크기',
  'settings.restore.modified': '마지막 수정',
  'settings.restore.version': '데이터베이스 버전',
  'settings.restore.versionValue': '{found} (이 앱은 {supported}까지 읽음)',
  'settings.restore.checkFailed': '파일을 검사할 수 없습니다.',
  'settings.restore.okIntro': '모든 검사를 통과한 백업입니다. 포함된 항목:',
  'settings.restore.blockedTitle': '이 파일은 복원할 수 없습니다:',
  'settings.restore.undo': '현재 데이터는 먼저 새 백업으로 저장되므로 복원을 되돌릴 수 있습니다.',
  'settings.restore.confirm': '지금 복원',
  'settings.restore.working': '복원 중…',

  'settings.restore.problem.missing': '파일이 더 이상 존재하지 않습니다.',
  'settings.restore.problem.notAFile': '파일이 아니라 폴더입니다.',
  'settings.restore.problem.empty': '파일이 비어 있습니다.',
  'settings.restore.problem.notADatabase': 'Print Tracker 데이터베이스가 아닙니다.',
  'settings.restore.problem.corrupt': '데이터베이스가 손상되어 무결성 검사에 실패했습니다.',
  'settings.restore.problem.missingTables': '필요한 테이블이 없습니다: {items}',
  'settings.restore.problem.missingColumns': '필요한 열이 없습니다: {items}',
  'settings.restore.problem.newerSchema':
    '더 새로운 버전의 앱에서 만든 백업입니다 (데이터베이스 {found}, 이 앱은 {supported}까지 읽음). 앱을 업데이트한 후 다시 시도하세요.',
  'settings.restore.problem.foreignKeyViolations':
    '존재하지 않는 행을 참조하고 있어 데이터가 불완전합니다.',
  'settings.restore.problem.sameFile':
    '앱이 현재 사용 중인 데이터베이스입니다. 백업 파일을 선택하세요.',
  'settings.toast.copied': '데이터베이스 경로를 복사했습니다.',

  /* -------------------------------------------------------- system toasts */
  'toast.printRecorded': '인쇄 기록됨 — {name}',
  'toast.folderAdded': '"{name}" 추적 시작 — 파일 {count}개 색인됨.',
  'toast.folderRemoved': '"{name}" 추적을 중지했습니다.',

  /* --------------------------- notes attached to system-recorded events */
  'note.outputNewFile': '출력 폴더 "{folder}"에서 새 파일을 감지했습니다',
  'note.outputUpdatedFile': '출력 폴더 "{folder}"에서 파일이 변경되었습니다',
  'note.spoolerEventLog': 'Windows 인쇄 스풀러 이벤트 로그에서 보고됨',
  'note.spoolerQueue': 'Windows 인쇄 큐에서 제거된 작업(완료 또는 취소)'
}
