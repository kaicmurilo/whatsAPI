import type { DataTableProps } from '../types/components'

export function DataTable<Row>({ caption, columns, rows, getRowKey, isBusy = false }: DataTableProps<Row>) {
  return (
    <div className="data-table">
      <table aria-busy={isBusy}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align ?? 'start'}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-align={column.align ?? 'start'}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
