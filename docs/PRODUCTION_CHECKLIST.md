# Production Checklist

Do not start production classes until staging is stable and this checklist is materially complete.

## Infrastructure

- [ ] On-prem server specs documented.
- [ ] Network uplink and ISP SLA documented.
- [ ] Public IP/NAT/firewall configuration documented.
- [ ] UDP media port range sized for real load.
- [ ] Reverse proxy or load balancer configured.
- [ ] Separate media and Egress capacity plan.
- [ ] AWS fallback architecture documented.
- [ ] Backup network or outage policy documented.

## Security

- [ ] Dev keys removed.
- [ ] Secret rotation process documented.
- [ ] API rate limiting added.
- [ ] CORS locked to production domains.
- [ ] Admin/teacher authentication added.
- [ ] Participant tokens expire appropriately.
- [ ] Recording access is permission-controlled.
- [ ] Logs do not expose participant tokens.

## Reliability

- [ ] Monitoring dashboard live.
- [ ] Alerts configured.
- [ ] Incident runbook written.
- [ ] Backup and restore tested.
- [ ] Rolling deploy or maintenance window process defined.
- [ ] Egress failure recovery tested.
- [ ] Docker image/version pinning strategy defined.

## Capacity

- [ ] Load test harness ready.
- [ ] 1-room baseline measured.
- [ ] 5-room test measured.
- [ ] 10-room test measured.
- [ ] 15-room test measured.
- [ ] 23-room target test measured or production cap lowered.
- [ ] Per-node capacity documented.
- [ ] Bitrate and simulcast policy documented.

## Product

- [ ] Teacher flow approved.
- [ ] Student flow approved.
- [ ] Recording flow approved.
- [ ] Attendance/reporting flow approved.
- [ ] Support procedure for live class issues defined.
- [ ] Pilot class signoff completed.
