import { Badge } from "@/components/ui/badge";

interface DeliveryStatusBadgeProps {
  status: string;
}

const DeliveryStatusBadge = ({ status }: DeliveryStatusBadgeProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "requested":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "accepted":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "picked":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "in-transit":
        return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100";
      case "delivered":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "cancelled":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getStatusText = () => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Badge variant="outline" className={`${getStatusColor()} font-medium`}>
      {getStatusText()}
    </Badge>
  );
};

export default DeliveryStatusBadge;
