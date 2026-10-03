/**
 * TownInstances — the 4 new towns as TownScene subclasses.
 * The Village of Verdan is the default TownScene export ('Town' scene key,
 * legacy exact map). Each subclass passes its own scene key + WorldData town.
 * Phaser registers scenes by the super(key) arg, which flows through the
 * base constructor.
 */
import TownScene from './TownScene.js';

class ConfiguredTown extends TownScene {
  constructor(sceneKey, townKey) {
    super(sceneKey);
    this.townKey = townKey;
  }
}

export class PortMeridianScene extends ConfiguredTown {
  constructor() { super('PortMeridian', 'port'); }
}

export class StonewatchScene extends ConfiguredTown {
  constructor() { super('Stonewatch', 'stonewatch'); }
}

export class SkyholdScene extends ConfiguredTown {
  constructor() { super('Skyhold', 'skyhold'); }
}

export class AureliaScene extends ConfiguredTown {
  constructor() { super('Aurelia', 'capital'); }
}