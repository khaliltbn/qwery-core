import type { Meta, StoryObj } from '@storybook/react';
import { Columns } from './columns';

const meta: Meta<typeof Columns> = {
  title: 'Qwery/Datasource/Columns',
  component: Columns,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Columns>;

const mockColumns = [
  {
    name: 'id',
    description: 'Primary key identifier',
    dataType: 'integer',
    format: 'int4',
  },
  {
    name: 'email',
    description: 'User email address',
    dataType: 'character varying',
    format: 'varchar(255)',
  },
  {
    name: 'created_at',
    description: 'Timestamp when the record was created',
    dataType: 'timestamp with time zone',
    format: 'timestamptz',
  },
  {
    name: 'is_active',
    description: null,
    dataType: 'boolean',
    format: 'bool',
  },
  {
    name: 'price',
    description: 'Product price in cents',
    dataType: 'numeric',
    format: 'numeric(10,2)',
  },
  {
    name: 'metadata',
    description: 'Additional JSON metadata',
    dataType: 'jsonb',
    format: 'jsonb',
  },
  {
    name: 'tags',
    description: 'Array of tag strings',
    dataType: 'ARRAY',
    format: 'text[]',
  },
  {
    name: 'description',
    description: null,
    dataType: 'text',
    format: '',
  },
];

export const Basic: Story = {
  args: {
    columns: mockColumns,
  },
};

export const Empty: Story = {
  args: {
    columns: [],
  },
};

export const WithClickHandler: Story = {
  args: {
    columns: mockColumns,
    onColumnClick: (column) => {
      console.log('Column clicked:', column);
    },
  },
};

export const SingleColumn: Story = {
  args: {
    columns: [mockColumns[0]!],
  },
};

export const ManyColumns: Story = {
  args: {
    columns: [
      ...mockColumns,
      {
        name: 'updated_at',
        description: 'Timestamp when the record was last updated',
        dataType: 'timestamp with time zone',
        format: 'timestamptz',
      },
      {
        name: 'deleted_at',
        description: null,
        dataType: 'timestamp with time zone',
        format: 'timestamptz',
      },
      {
        name: 'status',
        description: 'Current status of the record',
        dataType: 'character varying',
        format: 'varchar(50)',
      },
    ],
  },
};
