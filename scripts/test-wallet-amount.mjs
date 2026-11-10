import assert from 'node:assert/strict';
import {parseRupeesToPaise} from '../frontend/lib/wallet-amount.ts';

const cases=[
 ['0.01',1],['0.05',5],['0.10',10],['0.29',29],['1',100],
 ['1.01',101],['12.9',1290],['100.99',10099],
 ['20000000',2_000_000_000],['20000000.00',2_000_000_000],
 ['  0.01  ',1],['0',null],['0.00',null],['-1',null],
 ['1e2',null],['1.234',null],['1.',null],['.01',null],
 ['01.00',null],['1,000.00',null],['Infinity',null],['NaN',null],
 ['20000000.01',null],['100000000',null],['',null],['  ',null],
 ['0.001',null],['1.999',null],['1_000',null]
];
for(const [input,expected] of cases){
 assert.equal(parseRupeesToPaise(input),expected,'Unexpected exact INR conversion: '+JSON.stringify(input));
}
const example='0.29';
assert.notEqual(Number(example)*100,29,'Fixture must reproduce the binary float hazard');
assert.equal(parseRupeesToPaise(example),29,'Decimal parser must avoid float rounding');
console.log('No payout minimum, exact rupees/paise conversion, strict bounds: PASS');
