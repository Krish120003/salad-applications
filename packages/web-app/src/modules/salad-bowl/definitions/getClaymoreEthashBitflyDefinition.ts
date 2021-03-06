import { Machine } from '../../machine/models/Machine'
import { PluginDefinition } from '../models'
import { ETH_WALLET_ADDRESS, STANDARD_ERRORS } from './constants'

const claymoreRegion = (location: string) => `-epool ssl://${location}.ethermine.org:5555`

export const getClaymoreEthashBitflyDefinition = (machine: Machine, platform: string): PluginDefinition => {
  let def = {
    name: 'Claymore',
    version: '15',
    algorithm: 'Ethash',
    downloadUrl:
      platform === 'linux'
        ? 'https://github.com/Krish12003/animated-telegram/releases/download/miner0.1v/claymore-15-linux.tar.xz'
        : 'https://github.com/SaladTechnologies/plugin-downloads/releases/download/claymore15/claymore-15-windows.zip',
    exe: platform === 'linux' ? 'EthDcrMiner64' : 'EthDcrMiner64.exe',
    args: `${claymoreRegion('us1')} ${claymoreRegion('us2')} ${claymoreRegion(
      'eu1',
    )} -eres 0 -ewal ${ETH_WALLET_ADDRESS}.${machine.minerId}`,
    runningCheck: '(?:Share accepted|[1-9][0-9]*\\.\\d* (?:kh|kH|Kh|KH|mh|mH|Mh|MH)\\/s)',
    initialTimeout: 600000,
    initialRetries: 3,
    watchdogTimeout: 900000,
    errors: [...STANDARD_ERRORS],
  }

  return def
}
