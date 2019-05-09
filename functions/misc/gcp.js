
const { GoogleToken } = require('gtoken');
const superagent = require('superagent')
class GCP {
    constructor(SA) {
        this.project = SA.project_id;
        this.gtoken = new GoogleToken({
            email: SA.client_email,
            key: SA.private_key,
            scope: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/service.management'] // or space-delimited string of scopes
        });
    }

    async WaitOperation(selflink, token) {
        return new Promise((resolve, reject) => {
            var interval = ""
            interval = setInterval(async () => {
                try {
                    var res = await superagent.get(selflink)
                        .set("Authorization", "Bearer " + token)
                    console.log("CHECK OPERATION: ", res.body)
                    if (res.body.status != "RUNNING") {
                        clearInterval(interval);
                        resolve()
                    }

                } catch (err) {
                    console.log("ERROR: ", err)
                }
            }, 10000)

        })
    }



    async CreateCluster() {
        var token = await this.gtoken.getToken();
        var username = crypto.randomBytes(40).toString('hex');
        var password = crypto.randomBytes(80).toString('hex');
        var clusterName = "benchlab-" + crypto.randomBytes(10).toString('hex');
        /*var result = await superagent.post(`https://serviceusage.googleapis.com/v1/projects/${this.project}/services:batchEnable`)
            .set("Authorization", "Bearer " + token)
            .send({
                "serviceIds": [
                    "container.googleapis.com"
                ]
            })

        await this.WaitOperation(result.body.name)
        */
        result = await superagent.post(`https://container.googleapis.com/v1/projects/${this.project}/zones/us-east1-c/clusters`)
            .set("Authorization", "Bearer " + token)
            .send({
                "cluster": {
                    "name": clusterName,
                    "description": "A cluster managed by benchlab",
                    "initialNodeCount": 1,
                    "nodeConfig": {
                        "machineType": "n1-standard-2",
                        "oauthScopes": [
                            "https://www.googleapis.com/auth/devstorage.read_only",
                            "https://www.googleapis.com/auth/logging.write",
                            "https://www.googleapis.com/auth/monitoring",
                            "https://www.googleapis.com/auth/service.management.readonly",
                            "https://www.googleapis.com/auth/servicecontrol",
                            "https://www.googleapis.com/auth/trace.append",
                        ]
                    },

                    "masterAuth": {
                        'username': username,
                        'password': password
                    },
                },

                "parent": `/projects/${this.project}/zones/us-east1-c`,
            })
        await this.WaitOperation(result.body.selfLink, this.token)
        var result = await superagent.get(`https://container.googleapis.com/v1/projects/${this.project}/zones/us-east1-c/clusters`)
            .set("Authorization", "Bearer " + token)
        var cluster = result.body.clusters.find((i) => {
            return i.name == clusterName
        })
        return { target: cluster.endpoint, username, password, clusterName }
    }

    async GetMetrics() {

        var token = await this.gtoken.getToken();
        var url = `https://content-monitoring.googleapis.com/v3/projects/${this.project}/timeSeries`
        return superagent.get(url)
            .set("Authorization", "Bearer " + token)
            .query({
                'aggregation.perSeriesAligner': 'ALIGN_NONE',
                'interval.startTime': '2019-05-04T02:40:34.279Z',
                'interval.endTime': '2019-05-04T10:51:34.279Z',
                'aggregation.crossSeriesReducer': 'REDUCE_NONE',
                'filter': `metric.type = "container.googleapis.com/container/cpu/utilization" AND resource.labels.container_name="test-cocd" `
            })

    }

    async GetLogs(cluster_name, namespace_id, container_name, start_timestamp, end_timestamp) {

        var token = await this.gtoken.getToken();
        var result = await superagent.post("https://logging.googleapis.com/v2/entries:list")
            .set("Authorization", "Bearer " + token)
            .send({
                "filter": `resource.type="container"
                        AND resource.labels.cluster_name="${cluster_name}"
                        AND resource.labels.namespace_id="${namespace_id}"
                        AND resource.labels.container_name="${container_name}"
                        AND timestamp>="${start_timestamp}"
                        AND timestamp<="${end_timestamp}"`,
                "orderBy": "timestamp desc",
                "pageSize": 100,
                "resourceNames": [
                    "projects/nicolas-test-239318"
                ]

            })
        var logs = result.body.entries.map((entry) => {
            return {
                "textPayload": entry.textPayload,
                "pod_id": entry.resource.labels.pod_id,
                "timestamp": entry.timestamp,
                "severity": entry.severity
            }
        })
        console.log(logs)
        return { logs, nextPageToken: result.body.nextPageToken }
    }

}


exports.GCP = GCP