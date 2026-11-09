export type PendingEnquirySubmission={fingerprint:string;submissionId:string};

/**
 * The same untouched payload reuses its request ID after a lost response.
 * Editing any field starts a new request, avoiding a false 409 on the API's
 * immutable idempotency contract.
 */
export function chooseEnquirySubmission(
 payload:Record<string,string|boolean|undefined>,
 previous:PendingEnquirySubmission|null,
 newId:()=>string
):PendingEnquirySubmission{
 const fingerprint=JSON.stringify(payload);
 if(previous?.fingerprint===fingerprint)return previous;
 return {fingerprint,submissionId:newId()};
}
