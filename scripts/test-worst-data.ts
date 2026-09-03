import { cleanCapture } from '@/lib/clean'
import { parseCapture, datasetFromRecords } from '@/lib/ingest'
import { assemble } from '@/lib/graph'

export const ADVERSARIAL_CAPTURE_CSV = `﻿"  Time Stamp  ",Transaction-ID[],"From_IP","Peer-IP","Port","Dest_Port","From_Addresses","Receiver_Addresses","Input_Values","Output_Values","Miner Fee","Output_Script_Type","Country_Code","Autonomous_System"
1787994164,d0c4bf4c49f736d51bab8913115dc99ef098b6acb956e877d551762be8cf2801,"54.73.254.44:8333","[2a01:4f8:c010:d56::1]:8333",,"8333","['bc1q4jrnf2amj5fprmfnh0p57gma9808z23lj5kp4k']","bc1qmw2c276m0nxa2flg9em3upgr5vrt9fvdce986p;bc1q7372xmq3za8qmm7t237xu9qwkx4lp54zn3he77",136287786,"80000000 sats|56287786 sats",0.0005659,P2WPKH,US,AS24940
29/08/2026 09:07:22,7e2eb9a6109228ce15c0288dcdfd5e2d9f64b3a5703607d2c04519ed12f39702,187.126.25.215,138.244.179.188:8332,8333,,"bc1qh0uh2h4s4wpgw4cnmdwkg4k9kftadmq9flg52s|bc1q42tuxg4d64l8se6cf5ea69y06h7clkd47v6n02","bc1qke7mpje93q6n60ajdj7pgkqdhgy0y6m6p7fmpf","₿0.48956488,₿0.51043512","1.00000000",0.00018218,,AE,AS55836
2026-08-29 09:10:06,31e4a307370659ab4aec97baca7cc0c262c4a6027759291f58c210e74c4aec03,"[2001:db8:85a3::8a2e:370:7334]",26.6.66.187:8333,9999,8333,"[bc1q7372xmq3za8qmm7t237xu9qwkx4lp54zn3he77]","[""bc1qufqudnldpxygy3y80hzgzlgpn05fu4ed5dwmxa""]",18417888,0.18417888,"0.00044655 ₿",P2SH,UA,AS13335
2026-08-29T09:11:29.052Z,c08aad8bb09983bb9729c7674d080dc93ffb01c392ea6742fbf66df02a8b7d04,54.73.254.44,175.42.37.229,8333,8333,"bc1qtd4jpdu638s236lc0mpak80anx7h97tv7jt0jr","bc1qdt5fhc26tqljnzvxlk5gyk5qm3spntlj52rvn5;bc1qj0cl6ql76jfhu2kdd2au44yfu6cxerzx55l5f7",57727122,"25000000|32727122 sats",0.00037176,P2WPKH,in,AS24940
1787995768000,83f25d38754dc2785c3bf0cf62214123753ebcbef9ecd195eb68006c7f3ea705,"119.109.192.113:443","54.73.254.44:8333",,,bc1qj0cl6ql76jfhu2kdd2au44yfu6cxerzx55l5f7,bc1qp7c35kqtufdpdaq0vz9qvymdwpjh4zp9ekun9p,"1500000 sats","€0.75909936",0.00065861,P2TR,,AS9498
1787995800,ba3c4d795baf28416c76c9f3ad17dfeeb19b7fe86eb8df5911a48de547d80806,207.125.180.251,187.126.25.215,8333,8333,"bc1qxcxjxc7zxjtnqjsk0fq0rsexsqpa9vhvt3a9y3","bc1qkz0dclec7thef0ljg6xayfzfpst96qdenmh8sp|bc1qmw2c276m0nxa2flg9em3upgr5vrt9fvdce986p|bc1q4jrnf2amj5fprmfnh0p57gma9808z23lj5kp4k",49013951,"10000000|20000000|19013951",0.00011759,P2PKH,DE,AS20473
2026-08-29 09:40:48.586Z,6f6c3e5659c20f1b381bf3aedb9a890844b74d899dc71dca0baa4f61a9bea307,207.125.180.251:8333,175.42.37.229:8333,,,"[""bc1qmw2c276m0nxa2flg9em3upgr5vrt9fvdce986p""]","[""bc1qufqudnldpxygy3y80hzgzlgpn05fu4ed5dwmxa""]",48094124,48094124,0.00022816,,,AS20473
29/08/2026 09:41,101ae7f2ecb785806683d85e501e776328bd2f780efc40dc3ba708d40116b108,110.9.171.125,207.125.180.251,8333,8333,bc1q96g2j38yxs27gmn0gngmamfwg8h4v2ue42q5hz,bc1qmw2c276m0nxa2flg9em3upgr5vrt9fvdce986p,32900947 sats,0.32900947,0.00065316,P2WPKH,GB,AS45609
1787996535,d6c409d2635d69dcc5c0cb02ef33387726a95b782a9c43729f334f6359e0a509,175.42.37.229:18333,54.73.254.44:8333,,,"['bc1q7372xmq3za8qmm7t237xu9qwkx4lp54zn3he77']","['bc1qp7c35kqtufdpdaq0vz9qvymdwpjh4zp9ekun9p']",9293128,0.09293128,0.000658,P2WPKH,FR,AS13335
29/08/2026 09:43:10,2963c2a227e0bfcf682077b169927134c7e1d5f8c505eb3d76548e3ea9ccf310,23.11.187.219:8333,119.109.192.113:8333,,,"bc1q42tuxg4d64l8se6cf5ea69y06h7clkd47v6n02","bc1qj0cl6ql76jfhu2kdd2au44yfu6cxerzx55l5f7",32574940,32574940,0.0002044,P2WPKH,NL,AS4837
2026-08-29 09:44:33,bc13908ee6a8ea8003e86a2186e4193faff2e50ec16883edff3bfdfa52168d11,207.125.180.251,23.11.187.219:8333,8333,,"bc1qxcxjxc7zxjtnqjsk0fq0rsexsqpa9vhvt3a9y3","bc1qxes3n072s87yq76xuqwc3upd952qwwu8gux0n7",29938653,₿0.29938653,0.00039439,P2WPKH,US,AS20473
2026-08-29T09:44:42Z,49377296a7aa7c1d67d9c0bbcb900ffb03a739099e3fb2fa0aa23762d5efc212,93.70.6.20,175.42.37.229,8333,8333,"bc1q6zzfwm63ztz6wdf0ush38ehvhrjdn8jt6pqw65","bc1q7t06xc9hvsnl5j06pqyevdquska0cgngsdnqge",54859921,"54859921 sats",0.00017594,P2WPKH,CA,AS13335
1787997178,f9e9833a55577820f98b9a62484aff5723b23706f230014acce6d886e4c1ae13,54.73.254.44:443,187.126.25.215,443,8333,"bc1qdt5fhc26tqljnzvxlk5gyk5qm3spntlj52rvn5","bc1qh0uh2h4s4wpgw4cnmdwkg4k9kftadmq9flg52s",22098316,22098316,0.0003278,P2PKH,JP,AS24940
29/08/2026 09:54:01,d97ee27beff533f84f4930549efcb0d9792c6e7a3410a5e372d4d5afe3876514,187.126.25.215,175.42.37.229,8333,8333,"bc1qke7mpje93q6n60ajdj7pgkqdhgy0y6m6p7fmpf","bc1q7t06xc9hvsnl5j06pqyevdquska0cgngsdnqge",61473148,61473148,0.00012674,P2WPKH,US,AS55836
2026-08-29 09:56:07.943Z,3d2a8e8133fa5b9d45a6ee04c74f3abd9bc7f91a55080322771f56ffddebfe15,119.109.192.113,187.126.25.215,8333,8333,bc1qnp9camjj02wcfsz8c45glsux5fkk0v5zghhemz,bc1qke7mpje93q6n60ajdj7pgkqdhgy0y6m6p7fmpf,28215795,28215795,0.00036675,P2WPKH,SG,AS9498
2026-08-29T09:59:46.068Z,dff00e4ee27cd310d6d0e810ad01acd6290c6957276ae1684b4fb583664ff116,23.11.187.219:8333,54.73.254.44:443,,,"bc1qxes3n072s87yq76xuqwc3upd952qwwu8gux0n7","bc1qdt5fhc26tqljnzvxlk5gyk5qm3spntlj52rvn5",86849460,86849460,0.00058365,P2PKH,DE,AS4837
1787997675,931007ab61155cd518503188f6ee8932b13a471356d8cb5e6bada2b3d8c93517,54.73.254.44,119.109.192.113,8333,8333,bc1q4jrnf2amj5fprmfnh0p57gma9808z23lj5kp4k,bc1qj0cl6ql76jfhu2kdd2au44yfu6cxerzx55l5f7,43213037,43213037,0.00015462,P2WPKH,CH,AS24940
29/08/2026 10:08:14,b0590aea6411bddba2ef06c867080b91589efcdfb28b0f902bf362eea1816018,54.73.254.44,175.42.37.229,8333,8333,bc1qdt5fhc26tqljnzvxlk5gyk5qm3spntlj52rvn5,bc1q7t06xc9hvsnl5j06pqyevdquska0cgngsdnqge,16553188,16553188,0.0005425,P2WPKH,AU,AS24940
2026-08-29 10:09:02.583Z,8aa0cb5992a3a4ceaadebf11745b8adea3be30d319e4c15b68902092079f2019,23.11.187.219:8333,175.42.37.229,,,"bc1q42tuxg4d64l8se6cf5ea69y06h7clkd47v6n02","bc1q7t06xc9hvsnl5j06pqyevdquska0cgngsdnqge",25343585,25343585,0.00065649,P2PKH,SE,AS4837
2026-08-29T10:28:04.626Z,8329d4ae991b333d7197e8c8bc9fcbed322a97d931db879d8a5c3900a3831220,119.109.192.113,93.70.6.20,8333,8333,bc1qnp9camjj02wcfsz8c45glsux5fkk0v5zghhemz,bc1qea3f809pksnjd5j0k8jjkv5602m4wjj87cw4d7,55351703,55351703,0.00024373,P2WPKH,BR,AS9498
1787999381,2359db0be7382747f6bd753c10b0f2b85f9f2d478ddb7f387de05a23aaa14d21,119.109.192.113,54.73.254.44:443,,,"bc1qnp9camjj02wcfsz8c45glsux5fkk0v5zghhemz","bc1qp7c35kqtufdpdaq0vz9qvymdwpjh4zp9ekun9p",56744892,56744892,0.00038692,P2WPKH,HK,AS9498
29/08/2026 10:32:00,192183f86554ca6b6b2322852530e75d04ccec365e192c3079f07439ea9eca22,93.70.6.20:8333,119.109.192.113,,,"bc1q9f5xmmrama8p45sdkmhyzdwerqgdezkvqg7ede|bc1q2vp4svyev7lrjzmcgxhhgfpzpkegywzw9gdy6a|bc1qc3sr8axjzvpxw6jgkr72fl9lpxtk7qd4ej6haw","bc1qjty5eq8vmqq233nzcdskc58emt5wpfn3hv6vsy","6969429;2851130;2851130",12671689,0.00050712,P2WPKH,ZA,AS13335
2026-08-29 10:32:13.294Z,5aa10ba577735ec6dd590205f53890eee782df3f47987361915946b401565523,93.70.6.20,26.6.66.187,8333,8333,bc1q9f5xmmrama8p45sdkmhyzdwerqgdezkvqg7ede,bc1q9gmzd9f7lu2pslm30q50zuuyxy74gu8nq6tnge,14738685,14738685,0.00033821,P2TR,AE,AS13335
2026-08-29 10:45:00.000Z,a11b22c33d44e55f66a77b88c99d00e11f22a33b44c55d66e77f88a99b00c124,"185.220.101.5:8333","185.220.101.7:8333",8333,8333,"['bc1qmix_in_1','bc1qmix_in_2','bc1qmix_in_3','bc1qmix_in_4']","['bc1qmix_out_1','bc1qmix_out_2','bc1qmix_out_3','bc1qmix_out_4']","50000000|50000000|50000000|50000000","50000000|50000000|50000000|50000000",0.00020000,P2WPKH,DE,AS24940
,"REJECT_MISSING_TIMESTAMP",10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,,10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498
INVALID_CORRUPTED_DATE_VAL,deadbeef0001,10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0002,999.888.777.666,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0003,10.0.0.1,corrupt_host_name,8333,8333,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0004,10.0.0.1,10.0.0.2,8333,8333,,,0.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0005,10.0.0.1,10.0.0.2,8333,8333,"bc1qaaa|bc1qbbb",bc1qccc,"0.5",0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0006,10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,"bc1qbbb|bc1qccc",0.5,"0.2|0.2|0.1",0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0007,10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,-1.5,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 12:00:00,deadbeef0008,10.0.0.1,10.0.0.2,8333,8333,bc1qaaa,bc1qbbb,NOT_A_VALID_AMOUNT_STRING,0.5,0.0001,P2WPKH,IN,AS9498
2026-08-29 10:32:13.294Z,5aa10ba577735ec6dd590205f53890eee782df3f47987361915946b401565523,93.70.6.20,26.6.66.187,8333,8333,bc1q9f5xmmrama8p45sdkmhyzdwerqgdezkvqg7ede,bc1q9gmzd9f7lu2pslm30q50zuuyxy74gu8nq6tnge,14738685,14738685,0.00033821,P2TR,AE,AS13335
`

const result = cleanCapture(ADVERSARIAL_CAPTURE_CSV, 'adversarial_worst_capture.csv')
console.log('--- CLEANING REPORT ---')
console.log('Total Rows Read:', result.report.totalRows)
console.log('Accepted Valid :', result.report.accepted)
console.log('Duplicates     :', result.report.duplicates)
console.log('Rejected Rows  :', result.report.rejected.length)
console.log('\n--- REJECTION AUDIT DETAILS ---')
result.report.rejected.forEach(r => console.log(` Row ${String(r.row).padStart(2)}: ${r.reason}`))
console.log('\n--- REPAIRS PERFORMED ---')
result.report.repairs.forEach(r => console.log(` ${r.label.padEnd(45)}: ${r.count}`))

const parsed = parseCapture(result.csv, 'adversarial_worst_capture.clean.csv')
console.log('\n--- INGESTION PARSER ---')
console.log('Parsed Records :', parsed.records.length)
console.log('Ingest Rejected:', parsed.rejected.length)

const ds = datasetFromRecords(parsed.records, 'adversarial_worst_capture.clean.csv', 'CSV')
const graph = assemble(ds)
console.log('\n--- GRAPH ASSEMBLY & MODEL FIT ---')
console.log('Wallets     :', ds.wallets.length)
console.log('Transactions:', ds.transactions.length)
console.log('IPs         :', ds.ips.length)
console.log('Entities    :', graph.entities.length)
console.log('Edges       :', graph.edges.length)
console.log('Model Name  :', graph.model.name, `(${graph.model.trainedOn} wallets trained, ${graph.model.flagged} flagged)`)
console.log('Planted Pats:', ds.planted.map(p => `${p.id} (${p.metric})`))
console.log('Alerts      :', graph.alerts.length)
console.log('Leads       :', graph.leads.length)
if (graph.leads[0]) {
  console.log('Lead 0      :', graph.leads[0].id, 'Risk:', graph.leads[0].risk, graph.leads[0].what)
}
