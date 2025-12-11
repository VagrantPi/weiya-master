export const IOTA_SNAP_ID = 'npm:@liquidlink-lab/iota-snap-for-metamask';

export const IOTA_SNAP_VERSION = '^1.0.0';

export type SnapStatus = 'NOT_INSTALLED' | 'INSTALLED' | 'CONNECTED' | 'ERROR';

export interface IotaSnapAccount {
  iotaAddress: string;
}

