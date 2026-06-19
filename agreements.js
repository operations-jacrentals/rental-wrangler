/**
 * agreements.js — Jac Rentals customer agreements shown + signed in the account
 * packet (§7.1). The right one is auto-selected by account type: Members sign the
 * Membership Agreement; everyone else signs the Rental Account Agreement.
 * Plain text (rendered white-space: pre-wrap). Have counsel review before go-live.
 */
export const AGREEMENTS = {
  rental: {
    title: 'Rental Account Agreement',
    text: `JAC RENTALS — RENTAL ACCOUNT AGREEMENT (Standard / Non-Member)

1. TERM & APPLICABILITY
This Agreement begins on the date Customer first rents Equipment or provides payment information, and remains in effect until terminated in writing (text message or email is acceptable). Jac may document rentals, usage, reservations, and related transactions through invoices, receipts, website reservations, point-of-sale records, dispatch logs, account records, electronic confirmations, or other business records ("Transaction Records"). All Transaction Records are incorporated into this Agreement. If a conflict exists, this Agreement controls. No additional signatures are required for future rentals or Equipment use under this Account.

2. RENTAL RATES
Equipment may be rented by the day, week, or month at the posted Retail Rates listed on the Jac Rentals Excavators website or otherwise provided by Jac. Retail Rates may or may not be publicly displayed and are subject to change. Renting Equipment does not guarantee Equipment availability. Customer may enroll in a Membership at any time to access discounted Member Rates under a separate Membership Agreement.

3. OVERAGES / NONPAYMENT
Payment is due upon invoice unless otherwise agreed. If a payment fails, Customer has 7 days to resolve it. Jac may charge the card on file for any balance owed. Failure to pay amounts owed when due is a material breach.

4. RENTAL PERIOD
Rental Period begins when Equipment leaves Jac's yard and ends when returned. Equipment may be rented by the day, week, or month at the applicable Retail Rate. Retail Rates are based on a 24-hour day, a 40-hour week, and a 160-hour month. Customer remains fully responsible for all rental obligations. Late return is a material breach.

5. RISK OF LOSS
Customer assumes all risk of loss, theft, damage, injury, or destruction from the moment Equipment leaves Jac's possession until returned. Customer is responsible for full replacement value if not returned. This obligation survives termination.

6. INDEMNIFICATION
Customer agrees to defend, indemnify, and hold harmless Jac, its owners, employees, and agents from all claims arising from possession, transportation, operation, or use of Equipment. This does not apply to losses caused solely by Jac's proven gross negligence or intentional misconduct.

7. INSPECTION & ACCEPTANCE
Customer confirms they have inspected the Equipment and confirm it is in working condition, and operators are qualified. Acceptance confirms Equipment is safe and suitable. Jac is not responsible for damage to Customer vehicles during towing or use.

8. USE OF EQUIPMENT
Equipment must be used legally and safely. No overloading or misuse. Daily maintenance checks required. Customer is responsible for fines, penalties, and damage from improper use. Jac may inspect or reclaim Equipment at any time.

9. DISCLAIMER OF WARRANTIES
Equipment is rented AS IS. Jac makes no warranties, express or implied, including merchantability or fitness for a particular purpose.

10. MALFUNCTION
If Equipment becomes unsafe, Customer must stop use immediately and notify Jac. Equipment must be returned within 24 hours. Customer's sole remedy is termination of rental charges after return.

11. DAMAGE / LOSS / TIRES
Customer pays for all damage, transit damage, theft, vandalism, and tire repair or replacement. Repair costs include ongoing rental until repairs are complete.

12. PAYMENT TERMS
Payment is due upon invoice unless agreed otherwise. Past due balances accrue the lesser of 1.5% per month or maximum allowed by law. Customer authorizes Jac to charge any card on file for rentals, overages, damages, taxes, fees, and collection costs.

13. CREDIT / DEBIT CARD AUTHORIZATION
Customer authorizes Jac to store card information securely and automatically charge rental charges and unpaid balances. Authorization remains until revoked in writing. Customer waives the right to dispute charges consistent with this Agreement. Customer agrees that, when adding new cards on file, authorization is provided by sending us a selfie while holding the new card.

14. DEFAULT
Customer is in default if payment fails, terms are violated, or insolvency occurs. Jac may terminate rentals, repossess Equipment, and recover attorney's fees and collection costs.

15. INSURANCE
Customer agrees to maintain throughout any active rental: $500,000 Commercial Auto Liability; $500,000 General Liability ($1,000,000 aggregate); Property coverage for the full replacement value of the rented Equipment. Insurance must be primary and non-contributory.

16. TITLE
This is a rental agreement only. Jac retains title at all times.

17. GOVERNING LAW
Governed by the laws of the State of Texas, without regard to conflict-of-law principles. Any claim or dispute shall be brought exclusively in the state courts of Jefferson County, Texas. Customer irrevocably consents to personal jurisdiction and waives objection to venue or forum. Both parties knowingly waive trial by jury. If Equipment is used outside Texas, Texas law and the exclusive venue still apply to the fullest extent permitted by law.

18. MISCELLANEOUS
No waiver unless in writing. If one provision is unenforceable, the remainder survives. Digital signatures are binding. This Agreement supersedes prior agreements.

19. RIGHT OF ENTRY & RECOVERY
If Customer defaults, fails to return Equipment when required, or if Jac reasonably believes Equipment is at risk, Jac may, without prior notice: enter any property where the Equipment is located; retrieve, repossess, disable, or remove the Equipment; use reasonable force permitted by law. Customer grants permission to enter private property (Customer's or any third party's) where Equipment is located, and waives any claim for trespass, property damage, conversion, or wrongful repossession arising from lawful recovery. Jac will not enter an occupied dwelling without consent and will not breach the peace. Customer is responsible for all recovery, repossession, transportation, storage, and attorney's fees. This right survives termination.

By signing, Customer acknowledges they have read, understood, and agree to this Rental Account Agreement.`,
  },
  membership: {
    title: 'Membership Agreement',
    text: `JAC RENTALS — MEMBERSHIP AGREEMENT

1. TERM & APPLICABILITY
This Agreement begins on the date Customer first enrolls in a Membership, rents Equipment, or provides payment information, and remains in effect until terminated in writing (text message or email is acceptable). Jac may document rentals, usage, reservations, membership charges, and related transactions through invoices, receipts, website reservations, point-of-sale records, dispatch logs, account records, electronic confirmations, or other business records ("Transaction Records"). All Transaction Records are incorporated into this Agreement. If a conflict exists, this Agreement controls. No additional signatures are required for future rentals, membership renewals, or Equipment use under this Account.

2. MEMBERSHIP STRUCTURE
Customers may choose one of the following membership plans: Monthly Plan – $299.00 per month (plus applicable taxes), billed on the first day of each month, first month pro-rated by enrollment date; Annual Plan – $2,691.00 per year (plus applicable taxes), billed in full at enrollment, with no separate enrollment or initiation fee. Regardless of plan, all memberships represent a 12-month commitment beginning on the enrollment date. The monthly option is a billing convenience, not a month-to-month arrangement. The monthly fee must remain current to keep membership active. Subscription amounts may change; Jac will notify Customer before changes take effect. Active membership gives Customer access to Member Rates for equipment rental, by the day, week, or month at the posted member rates on the Jac Rentals Excavators website. Membership does not guarantee Equipment availability.

3. CANCELLATION POLICY
Customer may cancel at any time by written notice (text or email). Cancellation stops future billing immediately with no penalty. Because membership represents a 12-month commitment, an account balance may remain when a Customer cancels before completing their full 12-month cycle. Jac will not charge this balance at the time of cancellation — it simply remains on the account. Reactivation: a former Customer wishing to access Member Rates again must bring their account current by paying any unpaid months from their original 12-month commitment; once that cycle is complete, a new 12-month commitment begins and Member Rates are reinstated going forward. Customers who choose not to reactivate are not pursued for any remaining balance, but Retail Rates apply to future rentals unless and until membership is reactivated and the account is brought current.

4. OVERAGES / NONPAYMENT
If a membership payment fails, Customer has 7 days to resolve it before membership lapses. After that, all active and future rentals convert to Retail Rates, which may or may not be publicly displayed. Jac may charge the card on file for any balance owed. Failure to maintain active membership is a material breach.

5. RENTAL PERIOD
Rental Period begins when Equipment leaves Jac's yard and ends when returned. Equipment may be rented by the day, week, or month at the applicable rate. Retail Rates are based on a 24-hour day, a 40-hour week, and a 160-hour month. Member Rates are posted on the Jac Rentals Excavators website. If Customer's membership lapses or is terminated for any reason, all active and future rentals convert to Retail Rates for the remainder of the Rental Period. Customer remains fully responsible for all rental obligations regardless of membership status. Late return is a material breach.

6. RISK OF LOSS
Customer assumes all risk of loss, theft, damage, injury, or destruction from the moment Equipment leaves Jac's possession until returned. Customer is responsible for full replacement value if not returned. This obligation survives termination.

7. INDEMNIFICATION
Customer agrees to defend, indemnify, and hold harmless Jac, its owners, employees, and agents from all claims arising from possession, transportation, operation, or use of Equipment. This does not apply to losses caused solely by Jac's proven gross negligence or intentional misconduct.

8. INSPECTION & ACCEPTANCE
Customer confirms they have inspected the Equipment and confirm it is in working condition, and operators are qualified. Acceptance confirms Equipment is safe and suitable. Jac is not responsible for damage to Customer vehicles during towing or use.

9. USE OF EQUIPMENT
Equipment must be used legally and safely. No overloading or misuse. Daily maintenance checks required. Customer is responsible for fines, penalties, and damage from improper use. Jac may inspect or reclaim Equipment at any time.

10. DISCLAIMER OF WARRANTIES
Equipment is rented AS IS. Jac makes no warranties, express or implied, including merchantability or fitness for a particular purpose.

11. MALFUNCTION
If Equipment becomes unsafe, Customer must stop use immediately and notify Jac. Equipment must be returned within 24 hours. Customer's sole remedy is termination of rental charges after return.

12. DAMAGE / LOSS / TIRES
Customer pays for all damage, transit damage, theft, vandalism, and tire repair or replacement. Repair costs include ongoing rental until repairs are complete.

13. PAYMENT TERMS
Payment is due upon invoice unless agreed otherwise. Past due balances accrue the lesser of 1.5% per month or maximum allowed by law. Customer authorizes Jac to charge any card on file for membership fees, rentals, overages, damages, taxes, fees, and collection costs.

14. CREDIT / DEBIT CARD AUTHORIZATION
Customer authorizes Jac to store card information securely and automatically charge recurring membership fees and unpaid balances. Authorization remains until revoked in writing. Customer waives the right to dispute charges consistent with this Agreement. Customer agrees that, when adding new cards on file, authorization is provided by sending us a selfie while holding the new card.

15. DEFAULT
Customer is in default if payment fails, membership lapses, terms are violated, or insolvency occurs. Jac may terminate rentals, convert usage to Retail Rates, repossess Equipment, and recover attorney's fees and collection costs.

16. INSURANCE
Customer agrees to maintain throughout any active rental: $500,000 Commercial Auto Liability; $500,000 General Liability ($1,000,000 aggregate); Property coverage for the full replacement value of the rented Equipment. Insurance must be primary and non-contributory.

17. TITLE
This is a rental agreement only. Jac retains title at all times.

18. GOVERNING LAW
Governed by the laws of the State of Texas, without regard to conflict-of-law principles. Any claim or dispute shall be brought exclusively in the state courts of Jefferson County, Texas. Customer irrevocably consents to personal jurisdiction and waives objection to venue or forum. Both parties knowingly waive trial by jury. If Equipment is used outside Texas, Texas law and the exclusive venue still apply to the fullest extent permitted by law.

19. MISCELLANEOUS
No waiver unless in writing. If one provision is unenforceable, the remainder survives. Digital signatures are binding. This Agreement supersedes prior agreements.

20. RIGHT OF ENTRY & RECOVERY
If Customer defaults, fails to return Equipment when required, fails to maintain an active paid Membership, or if Jac reasonably believes Equipment is at risk of loss or damage, Jac may, without prior notice: enter any property where the Equipment is located; retrieve, repossess, disable, or remove the Equipment; use reasonable force permitted by law. Customer grants permission to enter private property (Customer's or any third party's) where Equipment is located, and waives any claim for trespass, property damage, conversion, or wrongful repossession arising from lawful recovery. Jac will not enter an occupied dwelling without consent and will not breach the peace. Customer is responsible for all recovery, repossession, transportation, storage, and attorney's fees. This right survives termination.

By signing, Customer acknowledges they have read, understood, and agree to this Membership Agreement.`,
  },
};
export default AGREEMENTS;

/* ── Frozen agreement VERSIONS (§7.1b immutability, storage-light) ──
   A signing stores only a small `version` id, NOT the full ~6–8 KB text — the text
   is resolved from this append-only registry at display/PDF time. When an agreement
   above is revised, ADD a new dated entry here and bump AGREEMENT_CURRENT[key]; old
   signings keep resolving their original frozen text. Never edit a shipped entry. */
export const AGREEMENT_VERSIONS = {
  'rental@2026-06': { key: 'rental', title: AGREEMENTS.rental.title, text: AGREEMENTS.rental.text },
  'membership@2026-06': { key: 'membership', title: AGREEMENTS.membership.title, text: AGREEMENTS.membership.text },
};
export const AGREEMENT_CURRENT = { rental: 'rental@2026-06', membership: 'membership@2026-06' };

