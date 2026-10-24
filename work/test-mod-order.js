'use strict';
const assert=require('assert'),path=require('path');
const {resolveModOrder}=require(path.join(process.env.HEAT_PROFILE_TEST_WORK || __dirname,'HeatModOrder'));
const files=['UNITE.fbmod','Arcade.fbmod','Basic Stance.fbmod','Revert To Default Garage.fbmod'];
const input=[...files],music='Soundtrack.fbmod';
const result=resolveModOrder(input,music);
assert.deepStrictEqual(input,files,'User order must not be mutated');
assert.deepStrictEqual(result.executorOrder.map(f=>path.basename(f)),[music,...files.slice().reverse()]);
// Mirror the pinned executor's first-payload-wins rule for ordinary resources.
const values={ 'UNITE.fbmod':{garage:'unite',audio:'original',handling:'unite',stance:'unite'},
 'Arcade.fbmod':{handling:'arcade'},'Basic Stance.fbmod':{stance:'basic'},
 'Revert To Default Garage.fbmod':{garage:'vanilla'},'Soundtrack.fbmod':{audio:'custom'}};
const merged={};for(const file of result.executorOrder)for(const [key,value] of Object.entries(values[path.basename(file)]))if(!(key in merged))merged[key]=value;
assert.deepStrictEqual(merged,{audio:'custom',garage:'vanilla',stance:'basic',handling:'arcade'});
const noGarage=resolveModOrder(files.slice(0,3),music);assert(!noGarage.executorOrder.some(f=>f.includes('Default Garage')));
assert.deepStrictEqual(resolveModOrder([],music).executorOrder,[path.resolve(music)]);
assert.deepStrictEqual(resolveModOrder(['A.fbmod','B.fbmod'],null).executorOrder,[path.resolve('B.fbmod'),path.resolve('A.fbmod')]);
assert.throws(()=>resolveModOrder(['A.fbmod'],'a.fbmod'),/more than once/);
assert.throws(()=>resolveModOrder([],null),/At least/);
assert.throws(()=>resolveModOrder('bad',music),/array/);
console.log('PASS: priority, unchanged UI list, soundtrack only, optional garage, reorder, duplicates and invalid selection');
