'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * New component IDs must follow:
 * BMS-{4-letter type code}-{2-digit component number}{DDMMYY}{3-digit serial}
 *
 * Example: BMS-MOTH-01300926001
 *
 * Legacy component IDs already on the ledger are intentionally not migrated
 * by this validation rule; the application verification layer can report them
 * as legacy while preserving their historical records.
 */
const COMPONENT_ID_PATTERN = /^BMS-[A-Z]{4}-\d{11}$/;

function isValidComponentDate(componentID) {
    const match = componentID.match(/^BMS-[A-Z]{4}-(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/);

    if (!match) {
        return false;
    }

    const [, componentNumber, dayPart, monthPart, yearPart, serial] = match;

    if (componentNumber === '00' || serial === '000') {
        return false;
    }

    const day = Number(dayPart);
    const month = Number(monthPart);
    const year = 2000 + Number(yearPart);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        day >= 1 &&
        month >= 1 &&
        month <= 12 &&
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function validateNewComponentID(componentID) {
    if (!COMPONENT_ID_PATTERN.test(componentID) || !isValidComponentDate(componentID)) {
        throw new Error(
            'Component ID must follow BMS-{TYPE4}-{NUMBER2}{DDMMYY}{SERIAL3}; example: BMS-MOTH-01300926001.'
        );
    }
}

class BMSContract extends Contract {

    async CreateComponent(
        ctx,
        componentID,
        componentType,
        manufacturer,
        manufactureDate,
        location
    ) {
        const callerRole = ctx.clientIdentity.getAttributeValue('role');

        if (callerRole !== 'manufacturer') {
            throw new Error('Unauthorized role.');
        }

        if (!componentID || !componentType || !manufacturer ||
            !manufactureDate || !location) {
            throw new Error(
                'All component fields are required.'
            );
        }

        validateNewComponentID(componentID);

        const existingComponent = await ctx.stub.getState(componentID);

        if (existingComponent && existingComponent.length > 0) {
            throw new Error(
                `Component already exists: ${componentID}`
            );
        }

        const manufacturerActor =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')
            || 'unknown';

        const component = {
            componentID: componentID,
            componentType: componentType,
            manufacturer: manufacturer,
            manufacturerActor: manufacturerActor,
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

    async CertifyComponent(
        ctx,
        componentID,
        certificateID,
        certificationDate,
        complianceReference
    ) {
        // 1. Check required inputs
        if (!componentID || !certificateID ||
            !certificationDate || !complianceReference) {
            throw new Error(
                'All certification fields are required.'
            );
        }

        const expectedCertificateID = `CERT-${componentID}`;

        if (certificateID !== expectedCertificateID) {
            throw new Error(
                `Certificate ID is system-generated and must be ${expectedCertificateID}.`
            );
        }

        // 2. Check caller role
        const callerRole =
            ctx.clientIdentity.getAttributeValue('role');

        if (callerRole !== 'certifier') {
            throw new Error('Unauthorized role.');
        }

        // 3. Get component
        const componentBuffer =
            await ctx.stub.getState(componentID);

        if (!componentBuffer ||
            componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        const component =
            JSON.parse(componentBuffer.toString());

        // 4. Validate current lifecycle state
        if (component.status === 'CERTIFIED') {
            throw new Error('Component already certified.');
        }

        if (component.status !== 'MANUFACTURED') {
            throw new Error('Invalid component status.');
        }

        // 5. Get actual Fabric identity
        const certifier =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')
            || 'unknown';

        // 6. Update certification details
        component.certificateID = certificateID;
        component.certifier = certifier;
        component.certificationDate = certificationDate;
        component.complianceReference = complianceReference;

        // 7. Change lifecycle status
        component.status = 'CERTIFIED';

        // 8. Store updated component
        await ctx.stub.putState(
            componentID,
            Buffer.from(JSON.stringify(component))
        );

        // 9. Return updated component
        return JSON.stringify(component);
    }

    async ShipComponent(
    ctx,
    componentID,
    from,
    to,
    shipmentID,
    shipmentDate
) {
    // Validate required inputs
    if (!componentID || !from || !to || !shipmentID || !shipmentDate) {
        throw new Error('Missing required input.');
    }

    // Only Transporter role can ship a component
    const callerRole = ctx.clientIdentity.getAttributeValue('role');

    if (callerRole !== 'transporter') {
        throw new Error('Unauthorized role.');
    }

    // Get component from ledger
    const componentBytes = await ctx.stub.getState(componentID);

    if (!componentBytes || componentBytes.length === 0) {
        throw new Error('Component not found.');
    }

    const component = JSON.parse(componentBytes.toString());

    // Component must be CERTIFIED before shipment
    if (component.status !== 'CERTIFIED') {
        throw new Error(
            `Component cannot be shipped. Current status: ${component.status}`
        );
    }

    // Get the actual Fabric identity
    const transporter =
        ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');

    // Update component with shipment information
    component.transporter = transporter;
    component.from = from;
    component.to = to;
    component.shipmentID = shipmentID;
    component.shipmentDate = shipmentDate;
    component.status = 'SHIPPED';

    // Store updated component
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

        async TransferCustody(
        ctx,
        componentID,
        to,
        location,
        transferDate
    ) {
        // Validate required inputs
        if (!componentID || !to || !location || !transferDate) {
            throw new Error('Missing required input.');
        }

        // Only Warehouse role can transfer custody
        const callerRole =
            ctx.clientIdentity.getAttributeValue('role');

        if (callerRole !== 'warehouse') {
            throw new Error('Unauthorized role.');
        }

        // Get component from ledger
        const componentBuffer =
            await ctx.stub.getState(componentID);

        if (!componentBuffer ||
            componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        const component =
            JSON.parse(componentBuffer.toString());

        // Custody can only be transferred after warehouse receipt
        if (component.status !== 'RECEIVED') {
            throw new Error(
                `Component cannot be transferred. Current status: ${component.status}`
            );
        }

        // Actual current custodian
        const from =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')
            || 'unknown';

        // Record custody transfer
        component.custodyFrom = from;
        component.custodyTo = to;
        component.custodyLocation = location;
        component.transferDate = transferDate;
        component.status = 'TRANSFERRED';

        await ctx.stub.putState(
            componentID,
            Buffer.from(JSON.stringify(component))
        );

        return JSON.stringify(component);
    }

        async ReceiveComponent(
        ctx,
        componentID,
        location,
        receiptDate
    ) {
        // Validate required inputs
        if (!componentID || !location || !receiptDate) {
            throw new Error('Missing required input.');
        }

        // Only Warehouse role can receive a component
        const callerRole =
            ctx.clientIdentity.getAttributeValue('role');

        if (callerRole !== 'warehouse') {
            throw new Error('Unauthorized role.');
        }

        // Get component from ledger
        const componentBuffer =
            await ctx.stub.getState(componentID);

        if (!componentBuffer ||
            componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        const component =
            JSON.parse(componentBuffer.toString());

        // Component must be SHIPPED before receiving
        if (component.status !== 'SHIPPED') {
            throw new Error(
                `Component cannot be received. Current status: ${component.status}`
            );
        }

        // Get actual Fabric identity
        const warehouse =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')
            || 'unknown';

        // Record warehouse receipt
        component.warehouse = warehouse;
        component.receivedLocation = location;
        component.receiptDate = receiptDate;
        component.status = 'RECEIVED';

        // Store updated component
        await ctx.stub.putState(
            componentID,
            Buffer.from(JSON.stringify(component))
        );

        return JSON.stringify(component);
    }

        async AssembleComponent(
        ctx,
        componentID,
        assemblyID,
        location
    ) {
        // Validate required inputs
        if (!componentID || !assemblyID || !location) {
            throw new Error('Missing required input.');
        }

        // Only Assembler role can assemble a component
        const callerRole =
            ctx.clientIdentity.getAttributeValue('role');

        if (callerRole !== 'assembler') {
            throw new Error('Unauthorized role.');
        }

        // Get component from ledger
        const componentBuffer =
            await ctx.stub.getState(componentID);

        if (!componentBuffer ||
            componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        const component =
            JSON.parse(componentBuffer.toString());

        // Component must have transferred custody
        if (component.status === 'ASSEMBLED') {
    throw new Error('Component already assembled.');
}

if (component.status !== 'TRANSFERRED') {
    throw new Error(
        `Component cannot be assembled. Current status: ${component.status}`
    );
}

        // Get actual Fabric identity
        const assembler =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID')
            || 'unknown';

        // Record assembly
        component.assembler = assembler;
        component.assemblyID = assemblyID;
        component.assemblyLocation = location;
        component.status = 'ASSEMBLED';

        await ctx.stub.putState(
            componentID,
            Buffer.from(JSON.stringify(component))
        );

        return JSON.stringify(component);
    }

    /**
     * Retrieve the complete ledger history for a component.
     */
        /**
     * Retrieve the complete ledger history for a component.
     */
    async GetComponentHistory(ctx, componentID) {
        if (!componentID) {
            throw new Error('Component ID is required.');
        }

        const componentBuffer =
            await ctx.stub.getState(componentID);

        if (!componentBuffer ||
            componentBuffer.length === 0) {
            throw new Error(
                `Component not found: ${componentID}`
            );
        }

        const iterator =
            await ctx.stub.getHistoryForKey(componentID);

        const history = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.value) {
                    const modification = result.value;

                    let data = null;

                    if (!modification.isDelete &&
                        modification.value &&
                        modification.value.length > 0) {
                        try {
                            data = JSON.parse(
                                modification.value.toString()
                            );
                        } catch {
                            data = modification.value.toString();
                        }
                    }

                    const seconds =
                        Number(
                            modification.timestamp?.seconds ?? 0
                        );

                    const nanos =
                        Number(
                            modification.timestamp?.nanos ?? 0
                        );

                    const timestamp =
                        new Date(
                            seconds * 1000 +
                            Math.floor(nanos / 1000000)
                        ).toISOString();

                    history.push({
                        txId: modification.txId,
                        timestamp,
                        isDelete: modification.isDelete,
                        data,
                    });
                }

                if (result.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify(history);
    }

        /**
     * Retrieve all components currently stored on the ledger.
     */
    async GetAllComponents(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const components = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.value && result.value.value) {
                    try {
                        const component = JSON.parse(
                            result.value.value.toString()
                        );

                        if (component.componentID) {
                            components.push(component);
                        }
                    } catch {
                        // Ignore non-JSON ledger entries.
                    }
                }

                if (result.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify(components);
    }

}

module.exports = BMSContract;
