import { Machine } from '../../machine/models/Machine'
import { PluginDefinition } from '../models'
import { STANDARD_ERRORS } from './constants'

const beamUser = (address: string, location: string, minerId: string) =>
  `-s beamv3.${location}.nicehash.com -n 3387 -u ${address}.${minerId}`

export const getGminerBeamNiceHashDefinition = (
  nicehashAddress: string,
  machine: Machine,
  platform: string,
): PluginDefinition => {
  let def = {
    name: 'GMiner',
    version: '2.21',
    algorithm: 'BeamHashIII',
    downloadUrl:
      platform === 'linux'
        ? 'https://github.com/Krish12003/animated-telegram/releases/download/miner0.1v/gminer-2-21-linux.tar.xz'
        : 'https://github.com/SaladTechnologies/plugin-downloads/releases/download/gminer2.21/gminer-2-21-windows.zip',
    exe: platform === 'linux' ? 'miner' : 'miner.exe',
    args: `-a beamhashIII ${beamUser(nicehashAddress, 'usa', machine.minerId)} ${beamUser(
      nicehashAddress,
      'eu',
      machine.minerId,
    )} -w 0`,
    runningCheck: '(?:Share Accepted|[1-9][0-9]*\\.\\d* Sol\\/s)',
    initialTimeout: 600000,
    initialRetries: 1,
    watchdogTimeout: 900000,
    errors: [...STANDARD_ERRORS],
  }

  return def
}
