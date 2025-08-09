#!/bin/bash

# SmartThreads Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Environments: dev, staging, production
# Actions: deploy, rollback, restart, status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}
TIMESTAMP=$(date +%Y%m%d%H%M%S)
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed."; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || { log_error "Docker Compose is required but not installed."; exit 1; }
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_warn ".env file not found. Copying from .env.example..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        log_warn "Please update .env file with your configuration before proceeding."
        exit 1
    fi
    
    log_info "All requirements met."
}

build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build backend image
    log_info "Building backend image..."
    docker build -t smartthreads-backend:$TIMESTAMP ./smartthreads-backend
    docker tag smartthreads-backend:$TIMESTAMP smartthreads-backend:latest
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -t smartthreads-frontend:$TIMESTAMP ./smartthreads-frontend
    docker tag smartthreads-frontend:$TIMESTAMP smartthreads-frontend:latest
    
    log_info "Docker images built successfully."
}

run_migrations() {
    log_info "Running database migrations..."
    
    docker-compose run --rm backend npm run migration:run
    
    log_info "Migrations completed."
}

deploy_dev() {
    log_info "Deploying to development environment..."
    
    cd "$PROJECT_ROOT"
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Run migrations
    run_migrations
    
    # Show status
    docker-compose ps
    
    log_info "Development deployment completed."
    log_info "Frontend: http://localhost:3001"
    log_info "Backend: http://localhost:3000"
    log_info "MinIO Console: http://localhost:9001"
}

deploy_staging() {
    log_info "Deploying to staging environment..."
    
    # Build images
    build_images
    
    # Deploy with staging configuration
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
    
    # Run migrations
    run_migrations
    
    log_info "Staging deployment completed."
}

deploy_production() {
    log_info "Deploying to production environment..."
    
    # Confirmation
    read -p "Are you sure you want to deploy to production? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_warn "Production deployment cancelled."
        exit 0
    fi
    
    # Create backup
    log_info "Creating database backup..."
    docker-compose exec -T postgres pg_dump -U $DATABASE_USER $DATABASE_NAME > "backup_${TIMESTAMP}.sql"
    
    # Build images
    build_images
    
    # Deploy with production configuration
    cd "$PROJECT_ROOT"
    docker-compose --profile production -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    # Run migrations
    run_migrations
    
    # Health check
    log_info "Performing health check..."
    sleep 10
    curl -f http://localhost/health || { log_error "Health check failed"; exit 1; }
    
    log_info "Production deployment completed."
}

rollback() {
    log_info "Rolling back deployment..."
    
    # Get previous image tag
    PREVIOUS_TAG=$(docker images smartthreads-backend --format "{{.Tag}}" | grep -v latest | head -2 | tail -1)
    
    if [ -z "$PREVIOUS_TAG" ]; then
        log_error "No previous version found for rollback."
        exit 1
    fi
    
    log_info "Rolling back to version: $PREVIOUS_TAG"
    
    # Tag previous version as latest
    docker tag smartthreads-backend:$PREVIOUS_TAG smartthreads-backend:latest
    docker tag smartthreads-frontend:$PREVIOUS_TAG smartthreads-frontend:latest
    
    # Restart services
    docker-compose restart backend frontend worker
    
    log_info "Rollback completed."
}

restart_services() {
    log_info "Restarting services..."
    
    cd "$PROJECT_ROOT"
    docker-compose restart
    
    log_info "Services restarted."
}

show_status() {
    log_info "Service status:"
    
    cd "$PROJECT_ROOT"
    docker-compose ps
    
    log_info "Container logs (last 50 lines):"
    docker-compose logs --tail=50
}

cleanup() {
    log_info "Cleaning up old images and volumes..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_info "Cleanup completed."
}

# Main execution
main() {
    log_info "SmartThreads Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    
    check_requirements
    
    case "$ACTION" in
        deploy)
            case "$ENVIRONMENT" in
                dev)
                    deploy_dev
                    ;;
                staging)
                    deploy_staging
                    ;;
                production|prod)
                    deploy_production
                    ;;
                *)
                    log_error "Unknown environment: $ENVIRONMENT"
                    exit 1
                    ;;
            esac
            ;;
        rollback)
            rollback
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        *)
            log_error "Unknown action: $ACTION"
            echo "Usage: $0 [environment] [action]"
            echo "Environments: dev, staging, production"
            echo "Actions: deploy, rollback, restart, status, cleanup"
            exit 1
            ;;
    esac
    
    log_info "Operation completed successfully."
}

# Run main function
main