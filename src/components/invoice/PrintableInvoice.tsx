import { forwardRef } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  guest: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    id_passport: string | null;
  };
  room: {
    room_number: string;
    room_type: string;
    price: number;
  };
  booking: {
    check_in: string;
    check_out: string;
    num_guests: number;
    booking_source: string;
  };
  services: {
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string;
  }[];
  roomCharges: number;
  serviceCharges: number;
  taxRate: number;
  taxAmount: number;
  bankFeeAmount?: number;
  totalAmount: number;
  property?: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
}

interface PrintableInvoiceProps {
  data: InvoiceData;
}

export const PrintableInvoice = forwardRef<HTMLDivElement, PrintableInvoiceProps>(
  ({ data }, ref) => {
    const nights = differenceInDays(
      new Date(data.booking.check_out),
      new Date(data.booking.check_in)
    );

    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 max-w-[800px] mx-auto print:p-0 print:max-w-none"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {data.property?.name || 'Villa PMS'}
            </h1>
            {data.property?.address && (
              <p className="text-gray-600 mt-1">{data.property.address}</p>
            )}
            {data.property?.phone && (
              <p className="text-gray-600">Tel: {data.property.phone}</p>
            )}
            {data.property?.email && (
              <p className="text-gray-600">Email: {data.property.email}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
            <p className="text-gray-600 mt-2">
              <span className="font-medium">Invoice #:</span> {data.invoiceNumber}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Date:</span>{' '}
              {format(data.invoiceDate, 'MMMM d, yyyy')}
            </p>
          </div>
        </div>

        <Separator className="bg-gray-300 my-6" />

        {/* Guest & Stay Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Bill To
            </h3>
            <p className="font-semibold text-lg">{data.guest.name}</p>
            {data.guest.phone && <p className="text-gray-600">{data.guest.phone}</p>}
            {data.guest.email && <p className="text-gray-600">{data.guest.email}</p>}
            {data.guest.address && <p className="text-gray-600">{data.guest.address}</p>}
            {data.guest.id_passport && (
              <p className="text-gray-600">ID/Passport: {data.guest.id_passport}</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stay Details
            </h3>
            <div className="space-y-1">
              <p>
                <span className="text-gray-600">Room:</span>{' '}
                <span className="font-medium">
                  {data.room.room_number} ({data.room.room_type})
                </span>
              </p>
              <p>
                <span className="text-gray-600">Check-in:</span>{' '}
                <span className="font-medium">
                  {format(new Date(data.booking.check_in), 'EEEE, MMMM d, yyyy')}
                </span>
              </p>
              <p>
                <span className="text-gray-600">Check-out:</span>{' '}
                <span className="font-medium">
                  {format(new Date(data.booking.check_out), 'EEEE, MMMM d, yyyy')}
                </span>
              </p>
              <p>
                <span className="text-gray-600">Duration:</span>{' '}
                <span className="font-medium">{nights} night(s)</span>
              </p>
              <p>
                <span className="text-gray-600">Guests:</span>{' '}
                <span className="font-medium">{data.booking.num_guests}</span>
              </p>
              {data.booking.booking_source !== 'direct' && (
                <p>
                  <span className="text-gray-600">Source:</span>{' '}
                  <span className="font-medium capitalize">
                    {data.booking.booking_source.replace('_', '.')}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Room Charges */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Room Charges
          </h3>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold">Description</th>
                <th className="text-center py-2 font-semibold">Nights</th>
                <th className="text-right py-2 font-semibold">Rate</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3">
                  Room {data.room.room_number} - {data.room.room_type}
                </td>
                <td className="py-3 text-center">{nights}</td>
                <td className="py-3 text-right">Rs. {data.room.price.toLocaleString()}</td>
                <td className="py-3 text-right font-medium">
                  Rs. {data.roomCharges.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Services */}
        {data.services.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Services & Extras
            </h3>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold">Service</th>
                  <th className="text-center py-2 font-semibold">Date</th>
                  <th className="text-center py-2 font-semibold">Qty</th>
                  <th className="text-right py-2 font-semibold">Rate</th>
                  <th className="text-right py-2 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((service, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2">{service.name}</td>
                    <td className="py-2 text-center">
                      {format(new Date(service.date), 'MMM d')}
                    </td>
                    <td className="py-2 text-center">{service.quantity}</td>
                    <td className="py-2 text-right">
                      Rs. {service.unit_price.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-medium">
                      Rs. {service.total_price.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Room Charges</span>
              <span>Rs. {data.roomCharges.toLocaleString()}</span>
            </div>
            {data.serviceCharges > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Service Charges</span>
                <span>Rs. {data.serviceCharges.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Tax ({Math.round(data.taxRate * 100)}%)</span>
              <span>Rs. {data.taxAmount.toLocaleString()}</span>
            </div>
            <Separator className="bg-gray-300 my-2" />
            <div className="flex justify-between py-2 text-xl font-bold">
              <span>Total Due</span>
              <span>Rs. {data.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Separator className="bg-gray-300 my-6" />
        <div className="text-center text-gray-500 text-sm">
          <p className="font-medium mb-2">Thank you for staying with us!</p>
          <p>We hope to see you again soon.</p>
          <p className="mt-4 text-xs">
            This is a computer-generated invoice. Generated on{' '}
            {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
    );
  }
);

PrintableInvoice.displayName = 'PrintableInvoice';
