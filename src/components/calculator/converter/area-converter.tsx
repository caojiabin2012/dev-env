import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function AreaConverter() {
  const group = getUnitGroup('area')!
  return <UnitConverter group={group} />
}
