import { strict as assert } from 'node:assert';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../README.md',import.meta.url),'utf8');
assert.match(source,/fixed 1:3 matrix/);
assert.match(source,/No live|not.*implement/i);
console.log('Nisvartha scope gate passed');
