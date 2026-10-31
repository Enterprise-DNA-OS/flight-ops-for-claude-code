# Record checks for charter and helicopter operators

Sources checked 31 October 2026. This system checks your own records against the rules and limits below and lists what is missing, late or out of line. It does not approve a flight, replace your flight and duty scheme, your exposition or operations manual, your chief pilot or your maintenance controller, and it does not decide whether a pilot is fit to fly.

## Flight and duty limits come from your scheme

New Zealand: [Civil Aviation Rule 135.803](https://www.aviation.govt.nz/rules/rule-part/part-135/subpart-k/) says an operator must not perform an air operation unless "a scheme has been established for the regulation of flight and duty times for every person flying as a flight crew member", acceptable to the Director. 135.803(c) requires an accurate record of each pilot's flight and duty times, kept for 12 months. [Advisory Circular AC119-2](https://www.aviation.govt.nz/rules/advisory-circulars/show/AC119-2) is the CAA's example scheme.

Australia: [Civil Aviation Order 48.1 Instrument 2019](https://www.legislation.gov.au/F2019L01070/latest/text) takes the limits from the Appendix the operator chooses, or an approved fatigue risk management system. Section 14.6 requires records of rosters, actual duty periods, actual flight times, rest and standby periods and any extended flight duty period; 14.7 requires them to be kept for at least 5 years.

The `limits` table holds your scheme's numbers. The seeded values are demo values only, not the rule and not any Appendix: set each one from your approved scheme with `/limit`. Duties and logged legs cannot be deleted, so the record keeping period is met by the database itself.

## Implemented checks

| Rule | What it finds | Default | Basis |
|---|---|---|---|
| FTL-DUTY-LENGTH | A duty in the last 90 days longer than the scheme's longest duty | `max_duty_hours` | Your scheme under NZ CAR 135.803 or CAO 48.1 |
| FTL-REST | Rest before a duty, in the last 90 days, shorter than the scheme's minimum | `min_rest_hours` | Your scheme |
| FTL-FLIGHT-HOURS | Flight time over the 7, 28 or 365 day limit, or duty time over the 7 day limit | `flight_hours_7d`, `flight_hours_28d`, `flight_hours_365d`, `duty_hours_7d` | Your scheme. NZ 135.803 sets a floor of its own for commercial transport; check your scheme against it |
| MEDICAL | A pilot with no medical expiry recorded, or an expired one | The expiry date on the certificate | NZ [CAR 67.61](https://www.aviation.govt.nz/rules/rule-part/part-67/subpart-b/): class 1 is 12 months, 6 months for single-pilot passenger operations at 40 or over. AU [CASR 67.205](https://www.legislation.gov.au/F1998B00220/latest/text): class 1 is 1 year. Record the expiry printed on the certificate |
| FLIGHT-REVIEW | A flight review older than the interval | `flight_review_months` 24 | NZ [CAR 61.39](https://www.aviation.govt.nz/rules/rule-part/part-61/subpart-a/) biennial flight review within the previous 24 months (an operator competency check under Part 135 can stand in: 61.39(b)). AU CASR 61.745: a class rating review runs to the end of the 24th month after the month it was done |
| OPERATOR-CHECK | An operator competency or proficiency check older than the interval | `competency_months` 12 | NZ [CAR 135.607](https://www.aviation.govt.nz/rules/rule-part/part-135/subpart-j/): route check and VFR assessment every 12 months, IFR competency every 6. AU [Part 135 MOS 12.08](https://www.legislation.gov.au/F2020L01622/latest/text): yearly for day VFR only pilots, every 6 months for everyone else. Set 6 if any of your pilots need it, or add a per-pilot interval with `/customise` |
| PAX-RECENCY | A pilot on a passenger trip from today on with fewer landings in the window than the rule needs | `recency_landings` 3 in `recency_days` 90 | NZ CAR 61.37(b): 3 take-offs and 3 landings in the 90 days before the flight to carry a passenger by day. AU CASR 61.395(1): 3 take-offs and 3 landings in the previous 90 days in an aircraft of that category. This system counts landings in the journey log, all categories together; night recency and the alternatives in 61.395(4) and (5) are not checked |
| TYPE-RATING | A pilot on a trip from today on with no rating recorded on that aircraft type | The `ratings` table | House rule: record the types each pilot is rated and checked on |
| ARC-EXPIRED | An active aircraft whose airworthiness review expiry has passed | `arc_expiry` | The expiry on the aircraft's airworthiness review or equivalent, from your maintenance provider |
| CHECK-OVERDUE | An aircraft past the airframe hours of its next scheduled check | `next_check_hours` | Your maintenance programme |
| DEFERRAL-EXPIRED | A deferred defect still open after its due date | `defects.due_on` | Your minimum equipment list or deferral procedure |
| MANIFEST | A flown trip that carried more passengers than the manifest lists | Count on the legs against names on the manifest | NZ [CAR 135.857](https://www.aviation.govt.nz/rules/rule-part/part-135/subpart-l/) daily flight record: the number of passengers and the combined weight of passengers, goods and baggage, kept 12 months (135.859). A named manifest is a house rule |
| JOURNEY-LOG | A past trip with legs that have no block times | Every leg logged | The daily flight record and journey log |
| PAYLOAD | A trip from today on where the pilot and manifest weigh more than the aircraft's payload | `aircraft.payload_kg`, fuel excluded | A planning flag. Weight and balance is the pilot in command's, from the flight manual (NZ CAR 135.303 and 135.305) |

`/attention` also lists medicals due within 45 days, aircraft within 10 hours of a check and deferrals due within 7 days, so they are seen before they lapse.

## What it does not do

- It does not hold your scheme's rules for split duties, standby, extensions, positioning, time zones or cumulative days off. Add the ones you need with `/customise`.
- It does not check night recency, instrument recency or the training and checking system records under CASR 119.170 and 119.225.
- It does not run weight and balance, fuel planning or performance.
- It does not track an aircraft's components, life limits or airworthiness directives. The aircraft maintenance system does.
