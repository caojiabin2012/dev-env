import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function DataConverter() {
  const group = getUnitGroup('data')!
  return <UnitConverter group={group} />
}
