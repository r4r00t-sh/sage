# E-Filing System – Kubernetes

Manifests to run the E-Filing stack in Kubernetes (namespace `efiling`). Use this when you want to run EFMP on a Kubernetes cluster instead of Docker Compose on a single server.

## When to use this

- You have (or will have) a Kubernetes cluster (e.g. cloud-managed: EKS, GKE, AKS; or self‑hosted: k3s, Kind, Minikube).
- You want scaling, rolling updates, and cluster-level management instead of a single-host Docker Compose setup.
- Your current Docker Compose setup stays as-is; the `k8s/` folder is an alternative deployment path.

## Prerequisites

- `kubectl` configured for your cluster
- Optional: [Ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) (e.g. nginx-ingress) for `ingress.yaml`
- For local dev: [Kind](https://kind.sigs.k8s.io/) or [Minikube](https://minikube.sigs.k8s.io/)

## Apply order

Apply in this order so dependencies exist before workloads that use them:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

Or apply the whole directory (order may matter on first run; if something fails, re-run):

```bash
kubectl apply -f k8s/
```

## Images

Backend and frontend use:

- `efiling-backend:latest`
- `efiling-frontend:latest`

Build and load (example for Kind):

```bash
# From repo root
docker build -t efiling-backend:latest ./backend
docker build -t efiling-frontend:latest ./frontend

# Kind: load into cluster
kind load docker-image efiling-backend:latest efiling-frontend:latest
```

For a real registry, tag and push, then set `imagePullPolicy: Always` and correct `image` in `backend.yaml` / `frontend.yaml`.

## Frontend API URL

`NEXT_PUBLIC_API_URL` is fixed at **build time** in Next.js. For production:

- Build the frontend image with the correct API base URL, e.g.:
  - Same origin: `NEXT_PUBLIC_API_URL=/api` (if Ingress forwards `/api` to the backend)
  - Or full URL: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- Rebuild the frontend image when changing this value.

## Secrets

`k8s/secrets.yaml` holds placeholder values. **Before production:**

1. Replace all secrets (DB, RabbitMQ, MinIO, JWT, `database-url`, `rabbitmq-url`) with real values.
2. Prefer a secret manager (e.g. Sealed Secrets, External Secrets, cloud secret manager) instead of plain YAML.

## Access

- **With Ingress**: Set `efiling.local` (or your host) in `/etc/hosts` to the Ingress IP, then open `http://efiling.local`.
- **Without Ingress**: Use port-forward:
  - Frontend: `kubectl port-forward -n efiling svc/frontend 3000:3000`
  - Backend: `kubectl port-forward -n efiling svc/backend 3001:3001`
  - Then use `http://localhost:3000` and ensure the frontend was built with `NEXT_PUBLIC_API_URL=http://localhost:3001`.

## MinIO bucket

Create the bucket `efiling-documents` (e.g. via MinIO console or mc). Backend expects this bucket name.

## Optional: one-shot apply script

```bash
#!/bin/bash
set -e
for f in namespace.yaml secrets.yaml pvc.yaml postgres.yaml redis.yaml rabbitmq.yaml minio.yaml backend.yaml frontend.yaml ingress.yaml; do
  kubectl apply -f "k8s/$f"
done
```

---

## Future use: production checklist

When you’re ready to run EFMP on Kubernetes (e.g. for sage.santhigiri.cloud):

1. **Cluster and tools**
   - Create or use a Kubernetes cluster.
   - Install `kubectl` and point it at the cluster.
   - Install an Ingress controller (e.g. nginx-ingress) if you want a single URL and TLS.

2. **Images**
   - Build and push backend/frontend images to a registry the cluster can pull from:
     ```bash
     docker build -t your-registry/efiling-backend:latest ./backend
     docker build -t your-registry/efiling-frontend:latest ./frontend
     docker push your-registry/efiling-backend:latest
     docker push your-registry/efiling-frontend:latest
     ```
   - Set the frontend image with the right API URL at **build time**, e.g.:
     `NEXT_PUBLIC_API_URL=https://sage.santhigiri.cloud/api` (or your Ingress host + `/api`).

3. **Manifests**
   - In `backend.yaml` / `frontend.yaml`: set `image` to your registry URLs (e.g. `your-registry/efiling-backend:latest`).
   - In `ingress.yaml`: set `host` to your domain (e.g. `sage.santhigiri.cloud`) and, if needed, enable TLS (cert-manager or a TLS secret).
   - In `secrets.yaml`: replace all placeholders with real values; do not commit real secrets (use a secret manager in production).

4. **Apply**
   - From the repo root, apply in order (see “Apply order” above), or run the one-shot script.
   - If something fails, fix the manifest and re-run `kubectl apply -f k8s/<file>.yaml`.

5. **DNS**
   - Point your domain (e.g. `sage.santhigiri.cloud`) to the Ingress (LoadBalancer IP/hostname or Ingress controller).

6. **Landing page (santhigiri.cloud)**
   - The current `k8s/` setup only defines the app (frontend + backend). The static landing at santhigiri.cloud is served by nginx on your current server. If you move everything to Kubernetes, you can add a second Ingress host for santhigiri.cloud and serve the `landing/` files via a small static-server Deployment or keep nginx off-cluster for that.