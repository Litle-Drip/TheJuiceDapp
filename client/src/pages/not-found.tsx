import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold" data-testid="text-404">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            This page doesn't exist. Head back to the Markets.
          </p>
          <Link href="/">
            <Button className="mt-4" data-testid="button-go-home">Go to Markets</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
