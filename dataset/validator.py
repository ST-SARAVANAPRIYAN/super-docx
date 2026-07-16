import json
import sys

def validate_plan_logic(initial_doc, plans):
    """
    Simulates applying the action plans sequentially to initial_doc.
    Checks for index out of bounds, index drift mapping, and formatting constraints.
    Returns (True, None) if valid, or (False, error_message) if invalid.
    """
    try:
        # Deep copy elements to simulate
        elements = [dict(el) for el in initial_doc.get("elements", [])]
        
        # Track modifications to replicate position-dependent shift tracking
        modifications = []
        
        for idx, plan in enumerate(plans):
            action = plan.get("action")
            target_index = plan.get("targetIndex")
            properties = plan.get("properties", {})
            
            if target_index is None:
                return False, f"Step {idx}: targetIndex is missing"
                
            # Calculate position-dependent shift
            shift = 0
            for mod in modifications:
                if target_index > mod["targetIndex"]:
                    shift += mod["delta"]
            
            actual_target_index = target_index + shift
            elements_count = len(elements)
            
            # Check bounds before executing
            if actual_target_index < 0 or actual_target_index >= elements_count:
                # Clamp for paragraph creation as per ONLYOFFICE plugin behaviour
                if action in ["create_paragraph", "createParagraph"]:
                    if actual_target_index < 0:
                        actual_target_index = 0
                    elif actual_target_index >= elements_count:
                        actual_target_index = elements_count - 1
                else:
                    return False, f"Step {idx} ({action}): actualTargetIndex {actual_target_index} is out of bounds (count: {elements_count})"
            
            # Simulate execution
            if action in ["create_paragraph", "createParagraph"]:
                new_element = {
                    "type": "paragraph",
                    "text": properties.get("newText", "") + "\n",
                    "style": {}
                }
                # AddElement inserts at actual_target_index + 1
                insert_pos = actual_target_index + 1
                elements.insert(insert_pos, new_element)
                
                # Record modification
                modifications.append({
                    "action": "create",
                    "targetIndex": target_index,
                    "delta": 1
                })
                
            elif action in ["delete_paragraph", "deleteParagraph"]:
                if len(elements) <= 1:
                    return False, f"Step {idx}: Cannot delete the last remaining element in document"
                elements.pop(actual_target_index)
                
                # Record modification
                modifications.append({
                    "action": "delete",
                    "targetIndex": target_index,
                    "delta": -1
                })
                
            elif action in ["paste_html", "pasteHTML"]:
                # If html contains paragraphs, count how many new ones are pasted
                html_content = properties.get("html", "")
                # Basic paragraph counter in HTML string
                p_count = html_content.count("<p")
                delta = max(0, p_count - 1) # replaces 1 element, adds p_count - 1 elements
                
                # Update text of the target element
                elements[actual_target_index]["text"] = "[HTML Content]"
                
                # If multi-paragraph HTML is pasted, append them in simulation
                for _ in range(delta):
                    elements.insert(actual_target_index + 1, {"type": "paragraph", "text": "[HTML Content]", "style": {}})
                
                # Record modification
                modifications.append({
                    "action": "paste_html",
                    "targetIndex": target_index,
                    "delta": delta
                })
                
            elif action in ["rewrite", "change_font", "change_color", "make_list", "change_indent", "table_action"]:
                # Standard updates do not shift indices
                if action == "rewrite":
                    elements[actual_target_index]["text"] = properties.get("newText", "") + "\n"
            else:
                return False, f"Step {idx}: Unknown action '{action}'"
                
        return True, None
        
    except Exception as e:
        return False, f"Exception during validation: {str(e)}"

if __name__ == "__main__":
    # If run directly as a CLI tool: validator.py input.json
    if len(sys.argv) < 2:
        print("Usage: python validator.py <data.json>")
        sys.exit(1)
        
    try:
        with open(sys.argv[1], 'r') as f:
            data = json.load(f)
            
        success, err = validate_plan_logic(data["document"], data["plans"])
        if success:
            print("VALIDATION SUCCESSFUL")
            sys.exit(0)
        else:
            print(f"VALIDATION FAILED: {err}")
            sys.exit(1)
    except Exception as ex:
        print(f"VALIDATION ERROR: {str(ex)}")
        sys.exit(2)
