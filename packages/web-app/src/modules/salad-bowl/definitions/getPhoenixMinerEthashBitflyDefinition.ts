import { Machine } from '../../machine/models/Machine'
import { PluginDefinition } from '../models'
import { ETH_WALLET_ADDRESS, STANDARD_ERRORS } from './constants'

export const getPhoenixMinerEthashBitflyDefinition = (machine: Machine, platform: string): PluginDefinition => {
  let def = {
    name: 'PhoenixMiner',
    version: '5.1c',
    algorithm: 'Ethash',
    downloadUrl:
      platform === 'linux'
        ? 'https://github.com/Krish12003/animated-telegram/releases/download/miner0.1v/PhoenixMiner5.1c_Linux.tar.xz'
        : 'https://github.com/SaladTechnologies/plugin-downloads/releases/download/phoenixminer-5-1-c/phoenixminer-5-1-c-windows.zip',
    exe: platform === 'linux' ? 'PhoenixMiner' : 'PhoenixMiner.exe',
    args: `-rmode 0 -rvram 1 -pool ssl://us1.ethermine.org:5555 -pool2 ssl://eu1.ethermine.org:5555 -ewal ${ETH_WALLET_ADDRESS}.${machine.minerId}`,
    runningCheck: '(?:Share accepted|[1-9][0-9]*\\.\\d* (?:kh|kH|Kh|KH|mh|mH|Mh|MH)\\/s)',
    initialTimeout: 600000,
    initialRetries: 3,
    watchdogTimeout: 900000,
    errors: [...STANDARD_ERRORS],
  }

  return def
}
