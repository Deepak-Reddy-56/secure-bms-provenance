'use strict';

const { Contract } = require('fabric-contract-api');

class BMSContract extends Contract {

    async CreateComponent(
        ctx,
        componentID,
        componentType,
        manufacturer,
        manufactureDate,
        location
    ) {
        if (!componentID || !componentType || !manufacturer ||
            !manufactureDate || !location) {
            throw new Error(
                'All component fields are required.'
            );
        }

        const existingComponent = await ctx.stub.getState(componentID);

        if (existingComponent && existingComponent.length > 0) {
            throw new Error(
                `Component already exists: ${componentID}`
            );
        }

        const component = {
            componentID: componentID,
            componentType: componentType,
            manufacturer: manufacturer,
            manufactureDate: manufactureDate,
            location: location,
            status: 'MANUFACTURED'
        };

        await ctx.stub.putState(
            componentID,
            Buffer.from(JSON.stringify(component))
        );

        return JSON.stringify(component);
    }

    async GetComponent(ctx, componentID) {
        if (!componentID) {
            throw new Error('Component ID is required.');
        }

        const componentBuffer = await ctx.stub.getState(componentID);

        if (!componentBuffer || componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        return componentBuffer.toString();
    }
}

module.exports = BMSContract;
