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

  'nav.dashboard': '대시보드',
  'nav.folders': '폴더',
  'nav.files': '파일',
  'nav.history': '인쇄 기록',
  'nav.settings': '설정',

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

  'source.watcher': '폴더 감시',
  'source.spooler': '스풀러',
  'source.manual': '수동',

  'unit.prints.one': '{count}회 인쇄',
  'unit.prints.other': '{count}회 인쇄',

  /* ------------------------------------------------------------ dashboard */
  'dashboard.title': '대시보드',
  'dashboard.subtitle': 'Print Tracker가 지금까지 색인하고 인쇄한 내용입니다.',
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

  /* -------------------------------------------------------------- folders */
  'folders.title': '폴더',
  'folders.subtitle':
    'Library 폴더는 색인되어 추적됩니다. Output 폴더는 새 파일이 들어올 때마다 인쇄로 기록합니다.',
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
  'files.searchPlaceholder': '이름 또는 경로 검색…',
  'files.allFolders': '모든 폴더',
  'files.sort.nameAsc': '이름 A→Z',
  'files.sort.nameDesc': '이름 Z→A',
  'files.sort.recent': '최근 변경순',
  'files.sort.prints': '인쇄 많은 순',
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
  'history.searchPlaceholder': '문서, 프린터 또는 메모 검색…',
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

  /* ------------------------------------------------------------- settings */
  'settings.title': '설정',
  'settings.subtitle': '탐지 방식과 폴링 동작, 애플리케이션 정보입니다.',

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
