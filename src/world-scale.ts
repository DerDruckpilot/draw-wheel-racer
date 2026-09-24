import {clamp} from './shapes';

/** The imported truck body is 3.2 world units long (roughly 4.5 metres).
 * All source props were normalized to a longest dimension of one, NOT one metre.
 * Convert the old placement sizes to consistent physical reference dimensions.
 * Natural outcrops and engineered bridges keep their authored dimensions. */
export const WORLD_UNITS_PER_METRE=3.2/4.5;
export const PROP_SCALE:Record<string,{factor:number;min:number;max:number}>={
  portable_generator:{factor:.248,min:.62,max:.62},       // compact portable generator, ~87 cm
  barrel_03:{factor:.48,min:.59,max:.70},                 // ~83–98 cm tall steel drum
  wooden_crate_01:{factor:.62,min:.55,max:1.65},           // supply boxes through large pushable freight
  old_military_crate:{factor:.62,min:.42,max:.82},
  vintage_oil_lamp:{factor:.25,min:.21,max:.25},
  wooden_picnic_table:{factor:.57,min:1.78,max:1.86},
  industrial_valve:{factor:.41,min:.60,max:.74},
  wooden_ladder_02:{factor:.6,min:1.8,max:2.7},
  concrete_road_barrier:{factor:.47,min:1.5,max:1.75},
  tree_stump_01:{factor:.4,min:.60,max:1.3},
  tree_stump_02:{factor:.4,min:.65,max:1.45},
  pine_sapling_small:{factor:.27,min:1.1,max:2.8},
  tree_small_02:{factor:.65,min:3.4,max:6.5},
  wild_rooibos_bush:{factor:.48,min:.42,max:1.1},
  grass_medium_01:{factor:.52,min:.16,max:.42},
  grass_low:{factor:.52,min:.20,max:.58},
  grass_clump:{factor:.46,min:.19,max:.52},
  fern_02:{factor:.8,min:.5,max:1.4},
  nettle_plant:{factor:.6,min:.35,max:.8},
};
export function propScale(asset:string,authored:number){
  const reference=PROP_SCALE[asset];return reference?clamp(authored*reference.factor,reference.min,reference.max):authored;
}
