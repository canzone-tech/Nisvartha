import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {maskPayoutDestination,sealPayoutDestination,unsealPayoutDestination}
 from '../backend/src/security/payout-vault.ts';

const original=process.env.PIN_VAULT_KEY;
try{
 process.env.PIN_VAULT_KEY=randomBytes(32).toString('base64url');
 const memberId=randomUUID(),payoutId=randomUUID();
 const bank={method:'BANK',holderName:'Test Recipient',
  accountNumber:'1234567890123456',ifsc:'HDFC0001234'};
 const upi={method:'UPI',upiId:'testperson@okbank'};
 const bankEncrypted=sealPayoutDestination('bank-profile',memberId,bank);
 const upiEncrypted=sealPayoutDestination('upi-profile',memberId,upi);
 assert.deepEqual(unsealPayoutDestination('bank-profile',memberId,bankEncrypted),bank);
 assert.deepEqual(unsealPayoutDestination('upi-profile',memberId,upiEncrypted),upi);
 assert.ok(!bankEncrypted.includes(bank.accountNumber),
  'Bank account leaked into ciphertext representation');
 assert.ok(!upiEncrypted.includes(upi.upiId),'UPI ID leaked into ciphertext');
 assert.equal(maskPayoutDestination(bank),'Bank ••••3456');
 assert.equal(maskPayoutDestination(upi),'UPI ••••@okbank');
 const payoutSnapshot=sealPayoutDestination('payout-snapshot',payoutId,
  unsealPayoutDestination('bank-profile',memberId,bankEncrypted));
 assert.deepEqual(unsealPayoutDestination('payout-snapshot',payoutId,payoutSnapshot),bank);
 assert.throws(()=>unsealPayoutDestination('payout-snapshot',memberId,payoutSnapshot),
  'Rebinding payout snapshot to another ID must fail');
 assert.throws(()=>unsealPayoutDestination('upi-profile',memberId,bankEncrypted),
  'Rebinding profile type must fail');
 assert.throws(()=>unsealPayoutDestination('bank-profile',randomUUID(),bankEncrypted),
  'Changing member ID must fail');
 const pieces=bankEncrypted.split('.');
 const tampered=[...pieces];
 tampered[3]=tampered[3][0]==='A'?'B'+tampered[3].slice(1):'A'+tampered[3].slice(1);
 assert.throws(()=>unsealPayoutDestination('bank-profile',memberId,tampered.join('.')),
  'Modified authentication tag must fail');
 process.env.PIN_VAULT_KEY=randomBytes(32).toString('base64url');
 assert.throws(()=>unsealPayoutDestination('bank-profile',memberId,bankEncrypted),
  'Different key must not decrypt existing Bank details');
 console.log('Payout Bank/UPI encryption, scoped snapshots, masking and tamper rejection: PASS');
}finally{
 if(original===undefined)delete process.env.PIN_VAULT_KEY;
 else process.env.PIN_VAULT_KEY=original;
}
