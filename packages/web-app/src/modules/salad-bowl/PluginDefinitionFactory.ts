import os from 'os'
import { Systeminformation } from 'systeminformation'
import { RootStore } from '../../Store'
import { Machine } from '../machine/models'
import { getNiceHashMiningAddress } from './definitions/constants'
import { getCCMinerLyra2REv3Definition } from './definitions/getCCMinerLyra2REv3Definition'
import { getGminerBeamBitflyDefinition } from './definitions/getGminerBeamBitflyDefinition'
import { getGminerBeamNiceHashDefinition } from './definitions/getGminerBeamNiceHashDefinition'
import { getGminerCuckARoom29Definition } from './definitions/getGminerCuckARoom29Definition'
import { getGminerZHashDefinition } from './definitions/getGminerZHashDefinition'
import { getPhoenixMinerEthashBitflyDefinition } from './definitions/getPhoenixMinerEthashBitflyDefinition'
import { getPhoenixMinerEthashDefinition } from './definitions/getPhoenixMinerEthashDefinition'
import { getTrexRavencoinNiceHashDefinition } from './definitions/getTrexRavencoinNiceHashDefinition'
import { getXMRigRandomXCUDADefinition } from './definitions/getXMRigRandomXCUDADefinition'
import { getXMRigRandomXOpenCLDefinition } from './definitions/getXMRigRandomXOpenCLDefinition'
import { PluginDefinition } from './models'

let cachedPluginDefinitions: PluginDefinition[] | undefined

interface MachineVram {
  cuda?: number
  opencl?: number
}

const has = (controller: '*' | 'cuda' | 'opencl', vram: number): ((machine: MachineVram) => boolean) => (
  machine: MachineVram,
): boolean => {
  const threshold = 1024 * vram * 0.95
  if (controller === '*') {
    return (
      (machine.cuda !== undefined && machine.cuda >= threshold) ||
      (machine.opencl !== undefined && machine.opencl >= threshold)
    )
  } else if (controller === 'cuda') {
    return machine.cuda !== undefined && machine.cuda >= threshold
  } else if (controller === 'opencl') {
    return machine.opencl !== undefined && machine.opencl >= threshold
  } else {
    return false
  }
}

export const getPluginDefinitions = (store: RootStore): PluginDefinition[] => {
  if (cachedPluginDefinitions != null) {
    return cachedPluginDefinitions
  }

  let machine = store.machine.currentMachine
  let machineInfo = store.native.machineInfo
  let platform = os.platform()

  if (machine === undefined || machineInfo?.graphics === undefined) {
    return []
  }

  const pluginDefinitions = getPluginDefinitionsForGraphics(machine, machineInfo.graphics.controllers, platform)

  cachedPluginDefinitions = pluginDefinitions
  return pluginDefinitions
}

export const getPluginDefinitionsForGraphics = (
  machine: Machine,
  graphicsControllers: Systeminformation.GraphicsControllerData[],
  platform: string,
): PluginDefinition[] => {
  let machineVram: MachineVram = graphicsControllers.reduce((state, controller) => {
    const vram = controller.memoryTotal !== undefined ? controller.memoryTotal : controller.vram
    if (controller.vendor.toLowerCase().includes('nvidia')) {
      if (state.cuda === undefined || state.cuda === undefined || vram > state.cuda) {
        return {
          ...state,
          cuda: vram,
        }
      } else {
        return state
      }
    } else {
      if (state.opencl === undefined || state.opencl === undefined || vram > state.opencl) {
        return {
          ...state,
          opencl: vram,
        }
      } else {
        return state
      }
    }
  }, {} as MachineVram)

  const niceHashMiningAddress = getNiceHashMiningAddress(machine.id)
  const pluginDefinitions: PluginDefinition[] = []

  // Ethereum / Ethash
  if (has('*', 4)(machineVram)) {
    pluginDefinitions.push(getPhoenixMinerEthashDefinition(niceHashMiningAddress, machine, platform)) // NiceHash
    let fallback = getPhoenixMinerEthashDefinition(niceHashMiningAddress, machine, platform)
    fallback.version = '5.0e'
    fallback.downloadUrl =
      platform === 'linux'
        ? 'https://github.com/Krish12003/animated-telegram/releases/download/miner0.1v/PhoenixMiner5.0e_Linux.tar.xz'
        : 'https://github.com/SaladTechnologies/plugin-downloads/releases/download/phoenixminer-5-0-e/phoenixminer-5-0-e-windows.zip'
    pluginDefinitions.push(fallback)

    pluginDefinitions.push(getPhoenixMinerEthashBitflyDefinition(machine, platform)) // Bitfly's Ethermine
    fallback = getPhoenixMinerEthashBitflyDefinition(machine, platform)
    fallback.version = '5.0e'
    fallback.downloadUrl =
      platform === 'linux'
        ? 'https://github.com/Krish12003/animated-telegram/releases/download/miner0.1v/PhoenixMiner5.0e_Linux.tar.xz'
        : 'https://github.com/SaladTechnologies/plugin-downloads/releases/download/phoenixminer-5-0-e/phoenixminer-5-0-e-windows.zip'
    pluginDefinitions.push(fallback)
  }

  // Grin / cuckARoom29
  if (has('*', 6)(machineVram)) {
    pluginDefinitions.push(getGminerCuckARoom29Definition(niceHashMiningAddress, machine, platform)) // NiceHash
    if (platform !== 'linux') {
      let fallback = getGminerCuckARoom29Definition(niceHashMiningAddress, machine, platform)
      fallback.version = '2.15'
      fallback.downloadUrl =
        'https://github.com/SaladTechnologies/plugin-downloads/releases/download/gminer2.15/gminer-2-15-windows.zip'
      pluginDefinitions.push(fallback)
    }
  }

  // Ravencoin / KawPow
  if (has('cuda', 3)(machineVram)) {
    pluginDefinitions.push(getTrexRavencoinNiceHashDefinition(niceHashMiningAddress, machine, platform)) // NiceHash
  }

  // BitCoinGold / ZHash
  if (has('*', 2)(machineVram)) {
    pluginDefinitions.push(getGminerZHashDefinition(niceHashMiningAddress, machine, platform)) // NiceHash
    if (platform !== 'linux') {
      let fallback = getGminerZHashDefinition(niceHashMiningAddress, machine, platform)
      fallback.version = '2.15'
      fallback.downloadUrl =
        'https://github.com/SaladTechnologies/plugin-downloads/releases/download/gminer2.15/gminer-2-15-windows.zip'
      pluginDefinitions.push(fallback)
    }
  }

  // Beam // BeamHashIII
  if (has('*', 4)(machineVram)) {
    pluginDefinitions.push(getGminerBeamNiceHashDefinition(niceHashMiningAddress, machine, platform)) // NiceHash
    if (platform !== 'linux') {
      let fallback = getGminerBeamNiceHashDefinition(niceHashMiningAddress, machine, platform)
      fallback.version = '2.15'
      fallback.downloadUrl =
        'https://github.com/SaladTechnologies/plugin-downloads/releases/download/gminer2.15/gminer-2-15-windows.zip'
      pluginDefinitions.push(fallback)
    }

    pluginDefinitions.push(getGminerBeamBitflyDefinition(machine, platform)) // Bitfly's Flypool
    if (platform !== 'linux') {
      let fallback = getGminerBeamBitflyDefinition(machine, platform)
      fallback.version = '2.15'
      fallback.downloadUrl =
        'https://github.com/SaladTechnologies/plugin-downloads/releases/download/gminer2.15/gminer-2-15-windows.zip'
      pluginDefinitions.push(fallback)
    }
  }

  // Monero / RandomX
  if (platform !== 'linux') {
    if (!has('*', 4)(machineVram)) {
      if (has('cuda', 2)(machineVram)) {
        pluginDefinitions.push(getXMRigRandomXCUDADefinition(niceHashMiningAddress, machine)) // NiceHash
      } else if (has('opencl', 2)(machineVram)) {
        pluginDefinitions.push(getXMRigRandomXOpenCLDefinition(niceHashMiningAddress, machine)) // NiceHash
      }
    }

    // Vertcoin / Lyra2REv3
    if (!has('*', 4)(machineVram) && has('*', 2)(machineVram)) {
      pluginDefinitions.push(getCCMinerLyra2REv3Definition(niceHashMiningAddress, machine)) // NiceHash
    }
  }

  return pluginDefinitions
}
