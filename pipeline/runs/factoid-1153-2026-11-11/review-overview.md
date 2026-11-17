# Review overview, factoid-1153-2026-11-11

Derived by summarize_review.py from the adjudication files in review/; do not edit.
Two independent LLM reviews per group, adjudicated by an agent against the frozen contract.
No statement is expert validated (manifest expert_accepted false).

## Decisions over all groups

- correct: 37, accepted, corrected in revised/
- correct_conservatively: 45, accepted, corrected in revised/ to the safer reading
- keep: 91, rejected, the extracted reading stays
- not_required: 62, rejected, the frozen contract does not require it
- model_gap: 74, recorded as a limit of the model, no correction
- reject: 1, rejected as wrong

Each group lists its corrections and the recorded model gaps; kept and rejected findings stay in the adjudication files.

## Group 1

Decisions: correct_conservatively 1, keep 2, not_required 2, model_gap 4. UIDs with findings: 22629, 22630, 22633, 22634, 22637, 22640, 22645, 22647.

- correct_conservatively, 22640: A consent (Zustimmung) to the foundation of Lochgarten is typed rv:Confirmation; the founders Konstantin and Giselbert carry rv:Beneficiary.
- model_gap, 22633: The settlement 'einem Vergleich zwischen dem Bischof von Basel und dem Kloster St. Blasien' is omitted; proposed as rv:Dispute with qualifier 'Vergleich' and two rv:Participant references, or as a model gap.
- model_gap, 22647: The settlement ('Beilegung des Streites') of the recorded dispute is omitted for lack of a type.
- model_gap, 22629: The abstention omits a godparent relation ('aus der Taufe gehoben') between Graf Otto von Cappenberg and Friedrich; it should be recorded as a model gap.
- model_gap, 22634: Father and son appear 'als Intervenient in DK. III. 58 für das Kloster Remiremont'; no act factoid can carry the intervention.

## Group 2

Decisions: correct_conservatively 1, keep 7, not_required 3, model_gap 5. UIDs with findings: 22652, 22653, 22654, 22657, 22658, 22659, 22660, 22662, 22663.

- model_gap, 22652: Friedrich's accession (Beitritt) to the Fürstenspruch is typed rv:Confirmation with rv:Grantor although accession is not a confirmation.
- model_gap, 22652: The content of the judgment, freedom from all imperial services, is not structured as a right via rf:concerns.
- correct_conservatively, 22653: The central statement, Friedrich's succession in the duchy of Swabia, is omitted; only the parenthood is extracted.
- model_gap, 22654: Konrad von Rietfeld (K000502) and Berengar von Albeck (B000529) appear only inside the rf:ground literal and are not referenced.
- model_gap, 22658: The fixed-term contract about castles, Dienstleute and Allodialgüter, the only substantive act, is omitted.
- model_gap, 22663: The joint refusal of restitution by Friedrich and Konrad III., the main statement, is not represented; reviewer suggests trimming the request's evidence to the second selector.

## Group 3

Decisions: correct 2, correct_conservatively 3, keep 4, not_required 5, model_gap 4. UIDs with findings: 22668, 22669, 22670, 22671, 22678, 22679, 22681, 22682, 22683, 22684, 22685, 22686, 22687, 22688.

- correct_conservatively, 22669: Abstention omits the central in-scope letter of Roger and the request for support of Welf.
- correct_conservatively, 22671: rv:Judgment with rv:Judge and rv:Respondent asserts a judicial proceeding the regest does not report.
- model_gap, 22671: The dependency in 'seiner Ministerialen' is not captured.
- correct, 22678: The temporal limit of the requested postponement is lost.
- model_gap, 22678: The king, at whom the intercession aims, carries no reference.
- correct, 22682: rv:Negotiation understates a mediated peace with stated terms.
- correct_conservatively, 22682: The revenue clause combines rf:partOf the peace with a performed rv:Grant.
- model_gap, 22682: Reciprocity 'dafür' between the two provisions is not represented.
- model_gap, 22687: Konrad's doubt about his son's succession and preference for his nephew have no factoid; optional rf:ground 'wegen seiner Jugend' on the entrustment.

## Group 4

Decisions: correct 8, correct_conservatively 4, keep 10, not_required 8, model_gap 6. UIDs with findings: 22689, 22691, 22693, 22695, 22697, 22698, 22699, 22700, 22701, 22702, 22705, 22706, 22707, 22708, 22710.

- model_gap, 22691: The closing oath of fealty and homage is not extracted; proposed as rv:FeudalRelationship.
- correct, 22691: The rf:ground loses the regest's attribution of the reason to Otto von Freising.
- model_gap, 22691: The preference over the late king's son 'unter Bedachtnahme auf das Gemeinwohl' is not captured.
- correct_conservatively, 22693: The decided legation of Hillin, Eberhard and Adam to Pope Eugen, Rome and Italy is missing.
- model_gap, 22693: Refusal to pardon a ministerial after withdrawal of favour is not extracted.
- correct, 22699: The promise to restore the former splendour of the empire is omitted while all sibling promises are extracted.
- correct, 22699: The notified anointing and enthronement by Archbishop Arnold and other bishops is not extracted.
- correct_conservatively, 22699: The request for the early return of the abbot of Ebrach (with the recommendation of the legates) is missing.
- correct_conservatively, 22700: The election to the succession of Konrad III loses its reference to Konrad.
- model_gap, 22701: König Konrad (III.) appears only inside the rf:ground literal and not as a reference.
- correct, 22702: König Konrad III. is identified as RI004-002-K000316, which is not a candidate of this packet (validation: actor_outside_packet).
- correct, 22705: The restitution is not linked to the donation of the same estate.
- correct, 22705: rv:Possession flattens 'gehört' (ownership); keep the exact word.
- model_gap, 22705: The founder relation ('ihrem Gründer') is not expressed.
- correct_conservatively, 22706: The judging princes are labelled and named 'Fürstenspruch', which names the verdict, not persons.
- correct, 22706: rf:refersToAct to the alienations could be read as confirming them; the opposition 'entgegen' is not expressed.
- correct, 22707: 'in Nachahmung' describes Friedrich's act, not Konrad's, and sits on the wrong factoid; the earlier act's type is inferred.
- model_gap, 22710: The spurious status of the charter (n. †83) is invisible in the graph.

## Group 5

Decisions: correct 5, correct_conservatively 3, keep 9, not_required 8, model_gap 8. UIDs with findings: 22711, 22712, 22713, 22714, 22715, 22717, 22718, 22719, 22721, 22722, 22723, 22724, 22725, 22726.

- correct, 22711: The two earlier privilege factoids lack the object they concern.
- correct, 22713: The election approbated by the pope is collapsed into the approbation instead of being its own earlier act.
- correct_conservatively, 22713: The announcement of a legate is omitted.
- correct, 22714: The earlier grant by the predecessors lacks Corvey as recipient.
- model_gap, 22715: Knut's renunciation is typed rv:Grant with Friedrich as recipient, asserting a transfer.
- model_gap, 22715: Homage and coronation of Sven are reduced to a qualifier.
- correct_conservatively, 22715: Friedrich bringing Hazzo's party to decide for Wichmann is omitted.
- correct, 22717: The request to spare the abbot of Prüm is omitted.
- model_gap, 22717: The counteraction of chancellor Arnold and notary Heinrich is omitted.
- correct, 22721: The disjunction 'vom Grafen Wilhelm oder anderen Fürsten' is lost; two parallel grantors read as joint investiture.
- model_gap, 22721: The direction of 'Nichte' is not expressible with two rv:Kin roles.
- model_gap, 22722: Friedrich's coronation in St. Emmeram is omitted.
- correct_conservatively, 22722: The embassy to Pope Eugen, Rome and the Italian cities is omitted.
- model_gap, 22724: Add rf:qualifier 'in Gegenwart' to mark the archbishop's mere presence.
- model_gap, 22725: Add qualifiers 'Vor' and 'auf den Vorschlag' to distinguish presence and proposal.
- model_gap, 22726: The confirmed right to accept donations of allodial goods is missing from rf:concerns.

## Group 6

Decisions: correct 2, correct_conservatively 5, keep 7, not_required 7, model_gap 10. UIDs with findings: 22732, 22733, 22735, 22736, 22737, 22738, 22740, 22741, 22742, 22743, 22744, 22746, 22747, 22748, 22750.

- model_gap, 22732: The threat of war and its condition 'falls der Gefangene nicht freigelassen werde' are not extracted.
- correct_conservatively, 22732: The captured envoy carries rv:Envoy in the complaint, although he is the person the complaint is about, not an envoy acting in it.
- model_gap, 22732: '(Friedrich?)' is mapped to the shared ruler IRI without a marker of the regest's doubt.
- correct, 22733: The proclamation of the Regensburg law is the Weistum that Friedrich confirms, so it should be the act the confirmation refers to, not rf:partOf it.
- model_gap, 22735: The central passage, Friedrich's intervention in the Augsburg election in favour of Dean Konrad of Konstanz, is not extracted.
- correct, 22735: The ruler's actor label is the pronoun 'ihm'.
- correct_conservatively, 22736: The abstention is unjustified, because Hildegard's letter to Friedrich is an in-scope act that rv:Communication covers.
- model_gap, 22737: The consenting princes carry rv:Participant, because no role for consent exists.
- correct_conservatively, 22740: Reading the chapel as a separate rv:Grant by Friedrich overreaches the passage.
- model_gap, 22742: The second object of the confirmation, the subordination to Cluny, sits in rf:qualifier instead of rf:concerns, on both confirmation factoids.
- model_gap, 22743: The kinship in the Latin name list ('et fratres', 'filios Wilielmi et Guidonis') is not extracted.
- model_gap, 22743: The confirmed 'Rechte' are dropped from rf:concerns.
- correct_conservatively, 22744: Typing Konrad's privilege as rv:Grant asserts a transfer that the passage does not state.
- model_gap, 22744: The 30-year possession is what the princes' judgment emphasises, and the graph does not link the two.
- model_gap, 22746: The extortion and the other deeds are allegations within Wibald's complaint, and the model cannot mark them as such.
- model_gap, 22746: The damage of about 900 Pfund and the destruction of the fortifications are omitted.
- correct_conservatively, 22750: The earlier promise is modelled as an act without a promisor; that the citizens promised is inferred, and the state roles Obligor and Creditor stand in an act.

## Group 7

Decisions: correct 5, correct_conservatively 8, keep 12, not_required 5, model_gap 7, reject 1. UIDs with findings: 22752, 22753, 22754, 22757, 22758, 22759, 22760, 22761, 22762, 22764, 22765, 22766, 22768, 22769, 22770, 22771.

- correct, 22752: Right label 'die Erlaubnis, Weide und Wald' is a truncated fragment.
- correct_conservatively, 22753: The investiture stands in reported speech ('investiert worden sei') but is recorded without any trace of that framing.
- model_gap, 22754: Writers of both letters recorded as rv:Participant for lack of a sender role.
- model_gap, 22754: The pope's astonishment and disapproval are not represented.
- model_gap, 22757: Eticho's ministeriality ('seinem Ministerialen Eticho') is not represented.
- model_gap, 22758: The betrothal of Richildis to King Alfons VII. and Alfons himself are not encoded.
- correct_conservatively, 22759: The pope's report of the Roman conspiracy and the second mandate that Wibald inform the king confidentially are omitted.
- correct, 22760: Friedrich's nameInSource 'Friedrich' does not occur in the only evidence selector 'seines Oheims, Konrad (III.)'.
- correct_conservatively, 22761: Wezel's advice to send Counts Rudolf von Ramsberg and Ulrich von Lenzburg and Eberhard von Bodman to Rome is omitted, so three named actors disappear.
- model_gap, 22761: Regret over the missing Roman confirmation and the denunciation of the Donation of Constantine are not represented.
- correct_conservatively, 22762: The summons of Heinrich Jasomirgott, his non-appearance and the renewed summons are omitted.
- model_gap, 22762: A negotiated settlement (Ausgleich) is typed rv:Judgment, which presupposes a verdict, while Friedrich is rv:Mediator.
- correct_conservatively, 22762: Roger is given rv:Respondent although the passage does not say the complaint was directed against him.
- correct, 22762: Friedrich's Grantor role rests on 'Friedrich verleiht', which the selector does not include.
- correct_conservatively, 22765: Konrad III.'s earlier proceeding is kept only as a literal; the actor (candidate K000316) is lost.
- correct_conservatively, 22766: 'seiner Vorgänger' is ambiguous between issuers and holders; rv:Grantor asserts issuance.
- correct, 22766: One Kinship factoid with Albert, Heinrich and their brothers suggests that Albert and Heinrich are related to each other.
- model_gap, 22768: The spurious status and the repetition of the unexecuted DH. IV. 293 a cannot be carried.
- correct, 22769: The stated parent relation 'seine Eltern' of Friedrich is not extracted as Parenthood.
- correct_conservatively, 22771: The possession factoid concerns a node bundling the Burg Monteacuto with 'allen Besitzungen', although the relative clause on Berta and Odo may refer to the possessions only.

## Group 8

Decisions: correct 7, correct_conservatively 7, keep 12, not_required 8, model_gap 7. UIDs with findings: 22772, 22773, 22774, 22775, 22776, 22777, 22779, 22780, 22781, 22782, 22783, 22784, 22785, 22786, 22787, 22788, 22789, 22791.

- model_gap, 22772: The precedent acts of Heinrich (IV.) and Lothar (III.) are typed rv:Grant although the regest says only 'nach dem Vorgang'; applies equally to urn:regesta:22772:precedent-lothar.
- correct_conservatively, 22772: The exemption that is the object of the confirmation has no right node; rf:concerns points only to the place Treviglio.
- correct_conservatively, 22774: The foundation of Alteburg, the earlier act Friedrich confirms, is collapsed into the confirmation; founders and the advising abbot are listed as participants of Friedrich's act.
- correct, 22775: rf:partOf links the drafting of the charter to Dietrich's commission, but it is a subsequent act, not a provision.
- correct_conservatively, 22775: Three archbishops are merged into one rf:FunctionalActor.
- correct_conservatively, 22777: Linking all confirmations, including the items after 'darüber hinaus', to Konrad's dispositions overreaches.
- correct, 22779: The exemption from tolls is typed rv:Toll, the right to levy tolls.
- model_gap, 22780: The relative clause naming the Count of Flanders as habitual unlawful collector of the gaulum is omitted.
- correct_conservatively, 22781: The usurpation of Homburg by Duke Matthäus, half of the regest, is omitted together with its actor.
- model_gap, 22784: The rebuilding of Hohenburg on clerical advice, the father's destruction and Bishop Burchard's help with the re-establishment and the Augustinian rule are omitted.
- model_gap, 22785: The heir relation of Count Hugo (von Dagsburg) to Eberhard is not extracted; a rv:Kinship factoid with qualifier 'heredis' is proposed.
- correct_conservatively, 22786: The protection names only the ruler; the lords of Bulgaro, whose acquisitions are protected, are missing.
- correct, 22787: The confirmation of the property names no recipient.
- correct, 22788: Four amounts and four conditions on one factoid lose which penalty applies under which condition.
- model_gap, 22788: The Dienstmannen of Lutry as rv:Participant overstate their part; keep or drop.
- model_gap, 22789: The toll collector of St. Paul is the subject of a jurisdiction, not a participant of the confirmation.
- correct_conservatively, 22789: The customs, the inhabitants' freedom and the judicial clarification have no node and no factoid; the inhabitants as beneficiaries are lost.
- correct, 22791: 'im Falle einer Invasion' conditions only the expulsion promise but sits on a factoid that also holds the unconditional non-concession; the same applies to urn:regesta:22791:p6-griechen-papst.
- model_gap, 22791: The Romans, Roger of Sicily and the Greek ruler, against whom the promises are directed, appear as rv:Participant; applies also to p1-roemer-unterwerfen, p3 and p6.
- correct, 22791: The cardinals who promise together with the pope are not referenced.
- correct, 22791: The triggering condition of clause 5 is not kept as rf:condition; rv:Petitioner for the king considered.

## Group 9

Decisions: correct 2, correct_conservatively 8, keep 16, not_required 6, model_gap 8. UIDs with findings: 22792, 22793, 22795, 22796, 22797, 22798, 22799, 22800, 22801, 22803, 22804, 22805, 22806, 22807, 22809, 22810, 22811, 22812.

- model_gap, 22792: Friedrich as summoner carries rv:Grantor; the vocabulary has no sender or summoner role.
- model_gap, 22792: rf:ground holds a purpose clause, not a reason; no property for the purpose of an act.
- correct, 22793: The representatives of Chiavenna are typed crm:E74_Group but use the bare register IRI instead of the ':community' form.
- correct, 22796: The confirmation points with rf:refersToAct to the oath and the promise, which the regest gives as completed preconditions, not as objects of the confirmation.
- correct_conservatively, 22796: The treaty factoid names only the negotiators; the two sides marked by 'beiderseitigen', Friedrich and Pope Eugen, are not referenced.
- model_gap, 22796: rv:Negotiation denies a conclusion, but a formulated treaty is more than a negotiation; no agreement type exists.
- correct_conservatively, 22796: Friedrich carries rv:Grantor in an oath sworn by a ministerial on the king's soul.
- model_gap, 22798: Interveners carry rv:Petitioner although the regest distinguishes 'Bitten' from 'Intervention'; forgery mark of the record not expressible.
- model_gap, 22799: The festal coronation is not extracted; the bishops to be deposed sit only in a qualifier.
- correct_conservatively, 22800: The judgment points to the Ulm disposition with rf:refersToAct and keeps only the bare word 'entgegen' as qualifier, so the opposition is lost.
- correct_conservatively, 22803: Both amounts sit on one donation factoid, so the binding of 20 Solidi to the hides and 4 Solidi to the mill is lost; a split into two donations is proposed.
- model_gap, 22804, 22806: No right type for a right of election (Propstwahl, Vogtwahl); no act type for subordination.
- model_gap, 22805: The deposition of Archbishop Heinrich of Mainz and three bishops by the cardinal legates, the central act of the record, is not recorded.
- correct_conservatively, 22807: The ambiguous 'durch'-clause (Fürstenspruch formulated by Duke Heinrich of Bavaria after testimony of Gottfried of Arnsberg and Markward of Grumbach) is folded into the 1151 judgment, making Heinrich a judge and the two witnesses of an act dated '(1151)'.
- correct_conservatively, 22807: The content of the judgment in the quoted Latin (goods enfeoffed by the former archbishop Friedrich shall return; such donations against the peace of the realm have no legal force) is not modelled.
- correct_conservatively, 22807: 'unter Konrad III. gefällt' does not make Konrad III the judge; rv:Participant with a qualifier is proposed.
- correct_conservatively, 22810: The pledge of fidelity is made against the attacks of the Count of Barcelona; neither the count nor this wording appears in the factoid.
- model_gap, 22811: 'alle Laien', the group excluded from the lordship of the city, are not referenced.

## Group 10

Decisions: correct 3, correct_conservatively 4, keep 5, not_required 8, model_gap 6. UIDs with findings: 22813, 22815, 22816, 22819, 22820, 22821, 22822, 22823, 22824, 22826, 22827, 22829, 22830, 22831.

- correct, 22813: The confirmation concerns the harbour installations, the Crau rights and the six castles, but its only selector ends at 'an Erzbischof Manasse'.
- correct_conservatively, 22816: The request's content, that Wibald induce the king to remove the wrong, is lost; the selector stops before 'zu beseitigen' and the king is not referenced.
- correct_conservatively, 22820: The qualifier 'in verfälschter Fassung' is attached to Friedrich's confirmation, although it qualifies the inserted papal privilege as an editorial text-critical remark.
- model_gap, 22821: 'die Freiheit vom Reichsdienst' lies in the selector but has no right node.
- model_gap, 22823: Friedrich as sender of the envoys carries rv:Participant; the run handles senders inconsistently.
- correct, 22823: Heinrich von Bayern stays regest-local although H000498 is the only remaining packet candidate; 22829 assigns H000498 to the same wording.
- model_gap, 22823: Wilhelm's succession to his father Roger is not extracted; optionally an rv:OfficeHolding with qualifier 'successerat'.
- correct, 22824: The unnamed relative of Manuel is referenced as rv:Participant of the assurance although she is only the intended partner of a planned marriage.
- correct_conservatively, 22826: The order names no party in whose favour the restitution is ordered.
- model_gap, 22827: Friedrich having the convicted knight beheaded is absent.
- correct_conservatively, 22829: Heinrich (von Bayern)'s renewed objection that he was not lawfully summoned and the adjournment of the matter are missing.
- model_gap, 22830: Count Emicho von Leiningen's withholding of the gift is absent; proposed rv:Possession with qualifier 'vorenthält' or at minimum an rf:ground on the request.
- model_gap, 22831: Wladislaw's reception into Friedrich's grace is not extracted.

## Group 11

Decisions: correct 3, correct_conservatively 1, keep 7, not_required 2, model_gap 9. UIDs with findings: 22861, 22862, 22945, 134420, 135064, 220518, 220519, 220528, 220529, 220530, 220531, 220532, 220541.

- model_gap, 22861: The derivation of the Vogtei 'aus der Hand des Königs' survives only as a qualifier; no role exists for the origin of a held right.
- model_gap, 22862: The toll exemption is typed rv:Toll, the right to levy toll, which is the opposite position.
- model_gap, 134420: The confirmation concerns 'die Rechte und Besitzungen', but rf:concerns points only to the possessions.
- correct, 135064: The word 'erwählten' that marks the judge as chosen for this case is dropped.
- model_gap, 220518: The marital relation in 'ihre beiden Ehemänner' is not recorded as rv:Marriage.
- model_gap, 220519: Konrad III's consent that Barbarossa take the cross, the regest's main statement, is not recorded.
- model_gap, 220528: The counts of Panizo are rv:Participant although they are the party against whom action is requested; rv:Respondent proposed.
- correct, 220528: The possession of the goods by the church of Bologna is not recorded, although a matching candidate exists.
- correct, 220529: Friedrich's request to the bishop to receive his chancellor and escort him to Faenza is omitted.
- model_gap, 220530: The condition 'nicht ohne päpstliche Erlaubnis' qualifies the bishop's unwillingness to swear, not the letter; the stance has no factoid of its own.
- model_gap, 220530: The demand is reported speech ('gefordert habe') but stands as an independent act.
- model_gap, 220530: The sender is rv:Grantor and the demand is typed rv:Request.
- correct_conservatively, 220532: The abstention is unjustified: the letter and the announced intercession with the emperor are expressible acts.
