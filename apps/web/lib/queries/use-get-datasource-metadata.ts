import { useQuery } from '@tanstack/react-query';
import type { Datasource, DatasourceMetadata } from '@qwery/domain/entities';
import { DatasourceKind } from '@qwery/domain/entities';
import { getDiscoveredDatasource, getExtension } from '@qwery/extensions-sdk';
import { apiPost } from '../repositories/api-client';

export function getDatasourceMetadataKey(
  datasourceProvider: string,
  driverId: string,
  datasourceId?: string,
) {
  return ['datasource-metadata', datasourceProvider, driverId, datasourceId];
}

export function useGetDatasourceMetadata(
  datasource: Datasource | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: getDatasourceMetadataKey(
      datasource?.datasource_provider || '',
      datasource?.datasource_driver || '',
      datasource?.id,
    ),
    queryFn: async (): Promise<DatasourceMetadata> => {
      if (!datasource || !datasource.datasource_provider) {
        throw new Error('Datasource is required');
      }

      // Get driver metadata to check runtime
      const dsMeta = await getDiscoveredDatasource(
        datasource.datasource_provider,
      );
      if (!dsMeta) {
        throw new Error('Datasource metadata not found');
      }

      const driver =
        dsMeta.drivers.find(
          (d) =>
            d.id === (datasource.config as { driverId?: string })?.driverId,
        ) ?? dsMeta.drivers[0];

      if (!driver) {
        throw new Error('Driver not found');
      }

      const runtime = driver.runtime ?? 'browser';

      // Handle browser drivers (embedded datasources) - client-side
      if (runtime === 'browser') {
        if (datasource.datasource_kind !== DatasourceKind.EMBEDDED) {
          throw new Error('Browser drivers require embedded datasources');
        }

        const extension = await getExtension(datasource.datasource_provider);
        if (!extension) {
          throw new Error('Extension not found');
        }

        const driverStorageKey =
          (datasource.config as { storageKey?: string })?.storageKey ??
          datasource.id ??
          datasource.slug ??
          datasource.name;
        const driverInstance = await extension.getDriver(
          driverStorageKey,
          datasource.config,
        );
        if (!driverInstance) {
          throw new Error('Driver not found');
        }

        return await driverInstance.metadata(datasource.config);
      }

      // Handle node drivers (remote datasources) via API
      if (runtime === 'node') {
        const response = await apiPost<{
          success: boolean;
          data: DatasourceMetadata;
        }>('/driver/command', {
          action: 'metadata',
          datasourceProvider: datasource.datasource_provider,
          driverId: driver.id,
          config: datasource.config,
        });
        return response.data;
      }

      throw new Error(`Unsupported driver runtime: ${runtime}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled:
      options?.enabled !== undefined
        ? options.enabled && !!datasource
        : !!datasource,
  });
}
