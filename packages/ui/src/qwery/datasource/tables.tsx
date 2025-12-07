import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shadcn/table';
import { ScrollArea } from '../../shadcn/scroll-area';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface TableListItem {
  tableName: string;
  description: string | null;
  rowsEstimated: number;
  sizeEstimated: string;
  numberOfColumns: number;
}

export interface TablesProps {
  tables: TableListItem[];
  onTableClick?: (table: TableListItem) => void;
  className?: string;
}

export function Tables({ tables, onTableClick, className }: TablesProps) {
  const { t } = useTranslation();

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (tables.length === 0) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <p className="text-muted-foreground text-sm">
          {t('datasource.tables.list.empty', {
            defaultValue: 'No tables found',
          })}
        </p>
      </div>
    );
  }

  const rowsText = (count: number) => {
    const template = t('datasource.tables.rows', {
      defaultValue: '{{count}} rows',
    });
    const formattedCount = formatNumber(count);
    // Replace {{count}} placeholder with actual count
    const result = template.replace(/\{\{count\}\}/g, formattedCount);
    // If replacement didn't happen (no placeholder), prepend the count
    return result === template ? `${formattedCount} ${template}` : result;
  };

  const columnsText = (count: number) => {
    const template = t('datasource.tables.columns', {
      defaultValue: '{{count}} columns',
    });
    // Replace {{count}} placeholder with actual count
    const result = template.replace(/\{\{count\}\}/g, count.toString());
    // If replacement didn't happen (no placeholder), prepend the count
    return result === template ? `${count} ${template}` : result;
  };

  return (
    <div className={cn('rounded-md border', className)}>
      <ScrollArea className="h-[600px]">
        <div className="relative w-full">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('datasource.tables.header.name', {
                    defaultValue: 'Table name',
                  })}
                </TableHead>
                <TableHead>
                  {t('datasource.tables.header.description', {
                    defaultValue: 'Description',
                  })}
                </TableHead>
                <TableHead className="text-right">
                  {t('datasource.tables.header.rows', {
                    defaultValue: 'Rows (Estimated)',
                  })}
                </TableHead>
                <TableHead className="text-right">
                  {t('datasource.tables.header.size', {
                    defaultValue: 'Size (Estimated)',
                  })}
                </TableHead>
                <TableHead className="text-right">
                  {t('datasource.tables.header.columns', {
                    defaultValue: 'Number of columns',
                  })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table, index) => (
                <TableRow
                  key={`${table.tableName}-${index}`}
                  className={onTableClick ? 'cursor-pointer' : undefined}
                  onClick={() => onTableClick?.(table)}
                  data-test={`table-row-${table.tableName}`}
                >
                  <TableCell className="font-medium">
                    {table.tableName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {table.description || (
                      <span className="text-muted-foreground/50">
                        {t('datasource.tables.noDescription', {
                          defaultValue: '—',
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {rowsText(table.rowsEstimated)}
                  </TableCell>
                  <TableCell className="text-right">
                    {t('datasource.tables.size', {
                      defaultValue: '{{size}}',
                    }).replace('{{size}}', table.sizeEstimated)}
                  </TableCell>
                  <TableCell className="text-right">
                    {columnsText(table.numberOfColumns)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}
