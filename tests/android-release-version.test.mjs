import test from 'node:test';
import assert from 'node:assert/strict';
import {stampGradle} from '../scripts/set-android-version.mjs';

test('Signature privée : numéro de version Android stable et croissant',()=>{
 const template='android { defaultConfig { versionCode 1\n versionName "1.0" } }';
 const a=stampGradle(template,1,'1.0.8'),b=stampGradle(template,2,'1.0.8');
 assert.equal(a.versionCode,108001);
 assert.equal(b.versionCode,108002);
 assert.equal(a.gradle.includes('versionCode 108001'),true);
 assert.equal(a.gradle.includes('versionName "1.0.8"'),true);
 assert.ok(b.versionCode>a.versionCode);
});

test('Numéro invalide ou bloc Gradle ambigu : arrêt avant signature',()=>{
 const template='versionCode 1\nversionName "1.0"';
 assert.throws(()=>stampGradle(template,0),/invalide/);
 assert.throws(()=>stampGradle(template,-1),/invalide/);
 assert.throws(()=>stampGradle(template,1,'bad-version'),/invalide/);
 assert.throws(()=>stampGradle(template+'\nversionCode 2',1),/ambigu/);
 assert.throws(()=>stampGradle('versionName "1.0"',1),/absent/);
});
