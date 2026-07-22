// Package authz decides what an authenticated operator may do.
//
// Two rules shape everything here.
//
// First, permissions are derived from the signed session, never from anything
// the caller supplies. The previous console read the actor from the request
// body and defaulted it to "superadmin" when absent, so an anonymous request
// was attributed to the highest-privilege identity (D-12).
//
// Second, the sensitive actions are not merely permissioned -- they require a
// second operator. Holding the role lets you *propose*; applying needs someone
// else to approve (D-13).
package authz

import "sort"

type Permission string

const (
	PermViewOperations   Permission = "operations.view"
	PermViewCustomers    Permission = "customers.view"
	PermFreezeWallet     Permission = "wallet.freeze"
	PermUnfreezeWallet   Permission = "wallet.unfreeze"
	PermFeatureEdit      Permission = "features.edit"
	PermKillSwitch       Permission = "kill_switch"
	PermProviderApprove  Permission = "provider.approve"
	PermMandateChange    Permission = "mandate.change"
	PermApproveChange    Permission = "change.approve"
	PermViewAudit        Permission = "audit.view"

	// Compliance work. Viewing a case and deciding it are separate: a support
	// agent may need to see that a payment is held without being able to clear
	// it.
	PermViewCases        Permission = "cases.view"
	PermDecideCases      Permission = "cases.decide"
	PermReviewDocuments  Permission = "kyc.review"
	PermDecideTier       Permission = "kyc.decide"
)

// rolePermissions is the whole model. It is intentionally small: a permission
// exists because a route checks it.
var rolePermissions = map[string][]Permission{
	"read_only": {
		PermViewOperations, PermViewAudit,
	},
	"support_agent": {
		PermViewOperations, PermViewCustomers, PermViewAudit,
		// Sees that a payment is held, cannot decide it.
		PermViewCases,
	},
	"ops_manager": {
		PermViewOperations, PermViewCustomers, PermViewAudit,
		PermFreezeWallet, PermUnfreezeWallet, PermFeatureEdit,
		PermKillSwitch, PermMandateChange, PermProviderApprove,
	},
	"compliance_officer": {
		PermViewOperations, PermViewCustomers, PermViewAudit,
		PermFreezeWallet, PermUnfreezeWallet,
		PermViewCases, PermDecideCases, PermReviewDocuments, PermDecideTier,
	},
	// An analyst works cases and reviews evidence but cannot change a
	// customer's verification tier: deciding standing is a separate
	// responsibility from investigating a payment.
	"risk_analyst": {
		PermViewOperations, PermViewCustomers, PermViewAudit,
		PermViewCases, PermDecideCases, PermReviewDocuments,
	},
	// `approver` is a separate role rather than a level, so that the ability to
	// approve someone else's change is granted deliberately and can be held by
	// someone who cannot propose.
	"approver": {
		PermViewOperations, PermViewAudit, PermApproveChange,
	},
}

// Sensitive actions may not be applied by the operator who proposed them. The
// set is explicit: adding an action here is what makes it require two people.
var requiresSecondOperator = map[string]bool{
	"wallet.freeze":    true,
	"wallet.unfreeze":  true,
	"kill_switch":      true,
	"resume_payments":  true,
	"features.edit":    true,
	"provider.approve": true,
	"mandate.change":   true,
}

// RequiresSecondOperator reports whether an action needs maker-checker.
// Unknown actions default to true: a new sensitive action must be added to the
// permission map to be usable at all, and until then it fails closed.
func RequiresSecondOperator(action string) bool {
	if v, ok := requiresSecondOperator[action]; ok {
		return v
	}
	return true
}

// PermissionsFor returns the union of permissions across the roles a session
// carries. Unknown roles contribute nothing rather than erroring, so a role
// added by identity-access before the control plane knows about it grants no
// access instead of accidentally granting all of it.
func PermissionsFor(roles []string) []Permission {
	seen := map[Permission]bool{}
	for _, r := range roles {
		for _, p := range rolePermissions[r] {
			seen[p] = true
		}
	}
	out := make([]Permission, 0, len(seen))
	for p := range seen {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// Can reports whether the roles carry a permission.
func Can(roles []string, p Permission) bool {
	for _, r := range roles {
		for _, have := range rolePermissions[r] {
			if have == p {
				return true
			}
		}
	}
	return false
}

// PermissionForAction maps a change action to the permission needed to propose
// it. An action with no mapping cannot be proposed at all.
var PermissionForAction = map[string]Permission{
	"wallet.freeze":    PermFreezeWallet,
	"wallet.unfreeze":  PermUnfreezeWallet,
	"kill_switch":      PermKillSwitch,
	// Resuming is as sensitive as stopping. An operator who trips a control and
	// can immediately untrip it alone has not been constrained by it.
	"resume_payments":  PermKillSwitch,
	"features.edit":    PermFeatureEdit,
	"provider.approve": PermProviderApprove,
	"mandate.change":   PermMandateChange,
}
