import React from 'react';

interface Column<T> {
  key:     keyof T | string;
  header:  string;
  width?:  string | number;
  align?:  'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns:    Column<T>[];
  data:       T[];
  keyField:   keyof T;
  emptyLabel?: string;
  maxHeight?:  number | string;
  onRowClick?: (row: T) => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  stickyHeader?: boolean;
}

export default function DataTable<T>({
  columns, data, keyField, emptyLabel = 'No data available',
  maxHeight, onRowClick, onScroll, stickyHeader = false,
}: DataTableProps<T>) {
  // Build a colgroup definition for consistent column widths between header and body
  const ColGroup = () => (
    <colgroup>
      {columns.map((col) => (
        // apply width only if present
        <col key={String(col.key)} style={col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined} />
      ))}
    </colgroup>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: maxHeight ? 1 : undefined, minHeight: maxHeight ? 0 : undefined }}>
      {/* Header table — stays fixed horizontally */}
      <div style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <ColGroup />
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{
                    padding: '8px 12px',
                    textAlign: col.align ?? 'left',
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.09em', textTransform: 'uppercase',
                    color: '#334155',
                    whiteSpace: 'nowrap',
                    background: stickyHeader ? 'rgba(2,6,23,0.95)' : 'rgba(255,255,255,0.025)',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body — scrollable horizontally and vertically */}
      <div onScroll={onScroll} style={{ overflowX: 'auto', overflowY: maxHeight ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', maxHeight, height: maxHeight, flex: maxHeight ? 1 : undefined, minHeight: maxHeight ? 0 : undefined }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <ColGroup />
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '32px', height: maxHeight ? 220 : undefined, textAlign: 'center', verticalAlign: 'middle', color: '#475569', fontSize: 12 }}
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      style={{
                        padding: '10px 12px',
                        textAlign: col.align ?? 'left',
                        fontSize: 12, color: '#94a3b8',
                      }}
                    >
                      {col.render
                        ? col.render(row, rowIdx)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
