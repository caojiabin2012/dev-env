import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function VolumeConverter() {
  const group = getUnitGroup('volume')!
  return <UnitConverter group={group} />
}
