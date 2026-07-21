package main

import (
	"log"
	"os"

	"github.com/ephera/payments/internal/workflow"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	addr := env("TEMPORAL_ADDRESS", "localhost:7233")
	c, err := client.Dial(client.Options{HostPort: addr})
	if err != nil {
		log.Fatalf("temporal dial: %v", err)
	}
	defer c.Close()

	w := worker.New(c, workflow.TaskQueue, worker.Options{})
	acts := workflow.NewActivities()

	w.RegisterWorkflow(workflow.DomesticTransferSim)
	w.RegisterWorkflow(workflow.AirtimePurchaseSim)
	w.RegisterActivity(acts)

	log.Printf("EPHERA payments worker listening on queue %s via %s", workflow.TaskQueue, addr)
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalf("worker failed: %v", err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
