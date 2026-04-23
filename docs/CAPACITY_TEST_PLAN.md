# Capacity Test Plan

## Target Load

- 25 simultaneous classes.
- 16 participants per class.
- All participants may publish camera.
- Each class duration target is 2 hours.

## Test Ladder

Run each ladder step separately and record CPU, memory, outbound bandwidth, packet loss, reconnects, join time, and Egress failures.

| Step     | Rooms | Participants | Required Scenario                                       |
| -------- | ----: | -----------: | ------------------------------------------------------- |
| Baseline |     1 |           16 | All camera, chat, screen share, recording.              |
| Small    |     5 |           80 | All camera, one screen share per room.                  |
| Medium   |    10 |          160 | All camera, selected recordings.                        |
| High     |    15 |          240 | All camera, selected recordings.                        |
| Pre-prod |    20 |          320 | All camera, selected recordings, restart/rejoin checks. |
| Target   |    25 |          400 | All camera, selected recordings, 2-hour soak.           |

## Pass Criteria

- CPU p95 below 70 percent on media nodes.
- Outbound network below 75 percent of NIC capacity.
- Packet loss p95 below 2 percent.
- Join time p95 below 5 seconds.
- No mass disconnects during 2-hour target soak.
- Recording files are playable and metadata reaches a terminal status.

## Required Report

The report must include infrastructure specs, LiveKit/Egress image versions, network uplink, bitrate profile, test tool version, raw metrics export, observed bottlenecks, and the approved production participant cap.
