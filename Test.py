import matplotlib.pyplot as plt
import matplotlib.patches as patches

def draw_mac_attack_diagram():
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.axis('off')

    # First set of messages (E', ..., X, F1, ..., Fr)
    ax.text(0.1, 0.9, "Set A: Messages of the form", fontsize=12, fontweight='bold')
    ax.text(0.1, 0.85, "E₁', E₂', ..., E_q', X, F₁, F₂, ..., F_r", fontsize=12)
    ax.text(0.1, 0.8, "Each X is unique, F blocks are fixed", fontsize=10)
    ax.add_patch(patches.Rectangle((0.05, 0.77), 0.9, 0.1, fill=None, edgecolor='blue', linewidth=1))

    # Second set of messages (Y, F1, ..., Fr)
    ax.text(0.1, 0.65, "Set B: Messages of the form", fontsize=12, fontweight='bold')
    ax.text(0.1, 0.6, "Y, F₁, F₂, ..., F_r", fontsize=12)
    ax.text(0.1, 0.55, "Each Y is unique, same fixed F blocks", fontsize=10)
    ax.add_patch(patches.Rectangle((0.05, 0.52), 0.9, 0.1, fill=None, edgecolor='green', linewidth=1))

    # Arrows showing birthday collision
    ax.annotate("", xy=(0.5, 0.77), xytext=(0.5, 0.62), arrowprops=dict(arrowstyle="->", lw=2))
    ax.text(0.52, 0.695, "MAC Collision via Birthday Paradox", fontsize=12, color='red')

    # MAC Equivalence
    ax.text(0.1, 0.45, "MAC(E₁, ..., E_q, X, F₁, ..., F_r) = MAC(Y, F₁, ..., F_r)", fontsize=12, color='purple')

    # Internal equivalence
    ax.text(0.1, 0.4, "⇒ MAC*(E₁, ..., E_q, X₀) = MAC*(Y₀)", fontsize=12)
    ax.text(0.1, 0.36, "⇒ X₀ ⊕ Y₀ = Intermediate Collision Value", fontsize=12)

    # Forgery
    ax.text(0.1, 0.25, "Forge new message: E₁, ..., E_q, (X₀ ⊕ Y₀) ⊕ Z, P₁, ..., P_t", fontsize=12, fontweight='bold')
    ax.text(0.1, 0.21, "This produces MAC = M (same as for Z, P₁, ..., P_t)", fontsize=12)

    # Attack complexity
    ax.text(0.1, 0.1, "Attack complexity: 2^(n/2)", fontsize=12, style='italic')
    ax.text(0.1, 0.06, "For DES (n=64): ~2^33 operations", fontsize=12, style='italic')

    plt.tight_layout()
    plt.show()

draw_mac_attack_diagram()
