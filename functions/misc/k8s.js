
const Client = require('kubernetes-client').Client


class K8S {
    constructor(cluster) {
        this.client = new Client({
            config: {
                url: 'https://' + cluster.target,
                auth: {
                    user: cluster.username,
                    pass: cluster.password,

                },
                insecureSkipTlsVerify: true,
            }
        })

    }
    async init() {
       return await this.client.loadSpec()
    }


    async deploy(gcpProject, repo, pipelineId) {
        var repoFormat = repo.split('/')[1];
        var deployment = {
            "kind": "Deployment",
            "spec": {
                "replicas": 1,
                "template": {
                    "spec": {
                        "containers": [
                            {
                                "image": `us.gcr.io/${gcpProject}/${repo}:${pipelineId}`,
                                "name": repoFormat,
                                "resources": {
                                    "limits":
                                        { "cpu": 0.2, memory: "256Mi" },
                                    "requests":
                                        { "cpu": 0.2, memory: "256Mi" }
                                },
                                "ports": [
                                    {
                                        "containerPort": 3001
                                    }
                                ]
                            }
                        ]
                    },
                    "metadata": {
                        "labels": {
                            "project": repoFormat
                        }
                    }
                },
                "selector": {
                    "matchLabels": {
                        "project": repoFormat
                    }
                }
            },
            "apiVersion": "apps/v1",
            "metadata": {
                "labels": {
                    "project": repoFormat
                },
                "name": repoFormat
            }
        }
        try {
            await this.client.apis.apps.v1.namespaces('default').deployments.post({ body: deployment })
        } catch (err) {
            if (err.code !== 409) throw err
            await this.client.apis.apps.v1.namespaces('default').deployments(repoFormat).put({ body: deployment })
        }

        var service = {
            "kind": "Service",
            "apiVersion": "v1",
            "metadata": {
                "name": repoFormat
            },
            "spec": {
                "selector": {
                    "project": repoFormat
                },
                "ports": [
                    {
                        "protocol": "TCP",
                        "port": 80,
                        "targetPort": 3001
                    }
                ],
                "type": "NodePort"
            }
        }
        try {

            await this.client.api.v1.namespaces('default').services.post({ body: service })
        } catch (err) {
            if (err.code !== 409) throw err
        }



    }
    async ingress(routing) {
        var ingress = {
            "apiVersion": "extensions/v1beta1",
            "kind": "Ingress",
            "metadata": {
                "name": "benchlab-ingress",
                "annotations": {
                    "kubernetes.io/ingress.class": "gce"
                }
            },
            "spec": {
                "rules": routing.map((r) => {
                    return {
                        "host": r.host,
                        "http": {
                            "paths": [

                                {
                                    "backend": {
                                        "serviceName": r.service,
                                        "servicePort": 80
                                    }
                                }
                            ]
                        }
                    }
                })
            }
        }



        try {
            await this.client.apis.extensions.v1beta1.namespaces('default').ingresses.post({ body: ingress })
        } catch (err) {
            if (err.code !== 409) throw err
            await this.client.apis.extensions.v1beta1.namespaces('default').ingresses('benchlab-ingress').put({ body: ingress })
        }

    }
    async getStatus(repo) {
        var repoFormat = repo.split('/')[1];
        return await this.client.apis.apps.v1beta1.namespaces('default').deployments(repoFormat).status.get()
    }
    async listSecret() {
        return await this.client.api.v1.namespaces('default').secrets.get()
    }
}


exports.K8S = K8S