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
        await this.WaitOperation(result.body.selfLink, token)
        var result = await superagent.get(`https://container.googleapis.com/v1/projects/${this.project}/zones/us-east1-c/clusters`)
            .set("Authorization", "Bearer " + token)
        var cluster = result.body.clusters.find((i) => {
            return i.name == clusterName
        })
        return { target: cluster.endpoint, username, password, clusterName }
    }
}


exports.GCP = GCP