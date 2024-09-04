import os
import json

# This Class is responsible for providing example viz form data for the assistant
# The Examples are stored in a dictionary with the key being the viz_type
# Main Structure: { "viz-type": { examples: [{...formData},{...formData}], controls: {} } }
# FormData Structure: { "key": any }

# The contents of the dictionary are loaded from file located in the same directory

class AssistantSupport:
    def __init__(self):
        self.support = {}
        self.load_examples()

    def load_examples(self):
        with open(os.path.join(os.path.dirname(__file__), "examples.json")) as file:
            self.support = json.load(file)

    def get_examples(self, viz_type):
        """Get examples for the given viz_type"""
        """Returns a list of examples if viz_type is found"""
        """Returns None if viz_type is not found"""
        if viz_type in self.support:
            return self.support[viz_type]["examples"]
        return None
    
    def get_controls(self, viz_type):
        """Get controls for the given viz_type"""
        """Returns a dictionary of controls if viz_type is found"""
        """Returns None if viz_type is not found"""
        if viz_type in self.support:
            return self.support[viz_type]["controls"]
        return None
    
    def get_datasource_from(self, viz_type):
        """Get datasource from the given viz_type"""
        """Returns a dictionary of datasource if viz_type is found"""
        """Returns None if viz_type is not found"""
        if viz_type in self.support:
            return self.support[viz_type]["controls"]["datasource"]["datasource"]
        return None
    
    def add_example(self, viz_type, example, controls):
        """Add a new example to the support data"""
        """Update Json file with new example"""
        """Returns true if example is added successfully"""
        """Returns false if example is not added successfully"""
        # Guard Clause return if
        # 1. viz_type is not string
        # 2. example is not dictionary
        # 3. controls is not dictionary
        if not isinstance(viz_type, str) or not isinstance(example, dict) or not isinstance(controls, dict):
            # Invalid input
            return False

        if viz_type not in self.support:
            self.support[viz_type] = {"examples": [], "controls": {}}
        self.support[viz_type]["examples"].append(example)
        self.support[viz_type]["controls"] = controls
        with open(os.path.join(os.path.dirname(__file__), "examples.json"), "w") as file:
            json.dump(self.support, file, indent=4)
            
    
        return True