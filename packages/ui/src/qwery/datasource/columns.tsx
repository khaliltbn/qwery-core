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

export interface ColumnListItem {
  name: string;
  description: string | null;
  dataType: string;
  format: string;
}

export interface ColumnsProps {
  columns: ColumnListItem[];
  onColumnClick?: (column: ColumnListItem) => void;
  className?: string;
}

export function Columns({ columns, onColumnClick, className }: ColumnsProps) {
  const { t } = useTranslation();

  if (columns.length === 0) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <p className="text-muted-foreground text-sm">
          {t('datasource.columns.list.empty', {
            defaultValue: 'No columns found',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <ScrollArea className="h-[600px]">
        <div className="relative w-full">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('datasource.columns.header.name', {
                    defaultValue: 'Name',
                  })}
                </TableHead>
                <TableHead>
                  {t('datasource.columns.header.description', {
                    defaultValue: 'Description',
                  })}
                </TableHead>
                <TableHead>
                  {t('datasource.columns.header.dataType', {
                    defaultValue: 'Data type',
                  })}
                </TableHead>
                <TableHead>
                  {t('datasource.columns.header.format', {
                    defaultValue: 'Format',
                  })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((column, index) => (
                <TableRow
                  key={`${column.name}-${index}`}
                  className={onColumnClick ? 'cursor-pointer' : undefined}
                  onClick={() => onColumnClick?.(column)}
                  data-test={`column-row-${column.name}`}
                >
                  <TableCell className="font-medium">{column.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {column.description || (
                      <span className="text-muted-foreground/50">
                        {t('datasource.columns.noDescription', {
                          defaultValue: '—',
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {column.dataType}
                    </code>
                  </TableCell>
                  <TableCell>
                    {column.format ? (
                      <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                        {column.format}
                      </code>
                    ) : (
                      <span className="text-muted-foreground/50">
                        {t('datasource.columns.noFormat', {
                          defaultValue: '—',
                        })}
                      </span>
                    )}
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
